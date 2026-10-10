import type { AxiosInstance } from 'axios';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress, verifyTypedData, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { linea } from 'viem/chains';
import { createApiHandler } from '../api';
import { PORTAL_ID } from '../lib/constants';
import type { OAuthStateRecord, OAuthStateStore } from '../oauth-state';

const TEST_PRIVATE_KEY = `0x${'11'.repeat(32)}` as Hex;
const SIGNER = privateKeyToAccount(TEST_PRIVATE_KEY);
const SUBJECT = '0x2222222222222222222222222222222222222222' as Address;
const GUILDS_URL = 'https://discord.com/api/users/@me/guilds';
const TOKEN_URL = 'https://discord.com/api/oauth2/token';
const API_TYPES = {
  Discord: [
    { name: 'id', type: 'uint256' },
    { name: 'name', type: 'string' },
    { name: 'subject', type: 'address' },
    { name: 'expirationDate', type: 'uint64' },
  ],
} as const;

const config = {
  VITE_DISCORD_CLIENT_ID: 'discord-client-id',
  DISCORD_CLIENT_SECRET: 'discord-client-secret',
  VITE_REDIRECT_URL: 'https://app.example.com',
  SIGNER_PRIVATE_KEY: TEST_PRIVATE_KEY,
  NODE_ENV: 'test',
  CONTEXT: 'production',
};

const http = {
  get: vi.fn(),
  post: vi.fn(),
} as unknown as AxiosInstance;

const NOW = 1_800_000_000_000;
const STATE_TTL_MS = 5 * 60_000;
const BROWSER_BINDING = 'fixture-browser-binding';
const stateRecords = new Map<string, { record: OAuthStateRecord; etag: string }>();
let stateSequence = 0;

const hash = (value: string): string => createHash('sha256').update(value).digest('hex');

const stateStore: OAuthStateStore = {
  async create(key, record) {
    if (stateRecords.has(key)) return false;
    stateRecords.set(key, { record, etag: '1' });
    return true;
  },
  async read(key) {
    return stateRecords.get(key) ?? null;
  },
  async compareAndSet(key, etag, record) {
    const current = stateRecords.get(key);
    if (!current || current.etag !== etag) return false;
    stateRecords.set(key, { record, etag: String(Number(etag) + 1) });
    return true;
  },
};

interface IssuedState {
  state: string;
  stateHash: string;
  cookieName: string;
  cookie: string;
}

const issueState = (
  overrides: Partial<OAuthStateRecord> = {},
  binding = BROWSER_BINDING,
): IssuedState => {
  const state = Buffer.from(String(stateSequence++).padStart(32, '0')).toString('base64url');
  const stateHash = hash(state);
  const cookieName = `discord_oauth_${stateHash.slice(0, 20)}`;
  stateRecords.set(stateHash, {
    etag: '1',
    record: {
      version: 1,
      flow: 'discord',
      browserBindingHash: hash(binding),
      subject: SUBJECT,
      chainId: linea.id,
      redirectUri: config.VITE_REDIRECT_URL,
      origin: 'https://app.example.com',
      environment: 'production',
      issuedAt: NOW,
      expiresAt: NOW + STATE_TTL_MS,
      status: 'pending',
      ...overrides,
    },
  });
  return { state, stateHash, cookieName, cookie: `${cookieName}=${binding}` };
};

const createRequest = (
  overrides: Record<string, unknown> = {},
  issued = issueState(),
  origin = 'https://app.example.com',
  cookie = issued.cookie,
) =>
  new Request('https://functions.example.com/.netlify/functions/api', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      cookie,
    },
    body: JSON.stringify({
      action: 'exchange',
      code: 'oauth-code',
      state: issued.state,
      subject: SUBJECT,
      chainId: linea.id,
      ...overrides,
    }),
  });

const createStartRequest = (
  overrides: Record<string, unknown> = {},
  origin = 'https://app.example.com',
) =>
  new Request('https://functions.example.com/.netlify/functions/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ action: 'start', subject: SUBJECT, chainId: linea.id, ...overrides }),
  });

const createContext = (ip = '203.0.113.10') => ({ ip }) as never;

const guild = (id: string, name = `Guild ${id}`) => ({ id, name });

describe('Discord signing API', () => {
  let handler: ReturnType<typeof createApiHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    stateRecords.clear();
    stateSequence = 0;
    vi.mocked(http.post).mockResolvedValue({ data: { access_token: 'access-token' } } as never);
    vi.mocked(http.get).mockResolvedValue({ data: [guild('123')] } as never);
    handler = createApiHandler({
      http,
      config: () => config,
      oauthStateStore: () => stateStore,
      now: () => NOW,
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('issues a server-generated OAuth state and browser-binding cookie', async () => {
    const response = await handler(createStartRequest(), createContext());
    const body = (await response.json()) as { authorizeUrl: string };
    const authorizeUrl = new URL(body.authorizeUrl);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    expect(response.headers.get('set-cookie')).toMatch(
      /^discord_oauth_[a-f0-9]{20}=.+; HttpOnly; Secure; SameSite=Lax;/,
    );
    expect(authorizeUrl.origin).toBe('https://discord.com');
    expect(authorizeUrl.pathname).toBe('/api/oauth2/authorize');
    expect(authorizeUrl.searchParams.get('redirect_uri')).toBe(config.VITE_REDIRECT_URL);
    expect(authorizeUrl.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('allows only one of twenty concurrent callbacks across handler instances', async () => {
    const issued = issueState();
    const secondInstance = createApiHandler({
      http,
      config: () => config,
      oauthStateStore: () => stateStore,
      now: () => NOW,
    });
    const callbacks = Array.from({ length: 20 }, (_, index) =>
      (index % 2 === 0 ? handler : secondInstance)(
        createRequest({}, issued),
        createContext(`203.0.113.${100 + index}`),
      ),
    );

    const responses = await Promise.all(callbacks);
    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 400)).toHaveLength(19);
    expect(http.post).toHaveBeenCalledTimes(1);
  });

  it('keeps an OAuth state consumed when the provider exchange fails', async () => {
    const issued = issueState();
    vi.mocked(http.post).mockRejectedValueOnce({ response: { status: 500 } });

    const first = await handler(createRequest({}, issued), createContext());
    const replay = await handler(createRequest({}, issued), createContext());

    expect(first.status).toBe(502);
    expect(replay.status).toBe(400);
    expect(http.post).toHaveBeenCalledTimes(1);
  });

  it('fails closed when state storage is unavailable', async () => {
    const issued = issueState();
    const unavailable: OAuthStateStore = {
      create: async () => {
        throw new Error('offline');
      },
      read: async () => {
        throw new Error('offline');
      },
      compareAndSet: async () => {
        throw new Error('offline');
      },
    };
    const offlineHandler = createApiHandler({
      http,
      config: () => config,
      oauthStateStore: () => unavailable,
      now: () => NOW,
    });

    const start = await offlineHandler(createStartRequest(), createContext());
    const exchange = await offlineHandler(createRequest({}, issued), createContext());
    expect(start.status).toBe(503);
    expect(exchange.status).toBe(503);
    expect(http.post).not.toHaveBeenCalled();
  });

  it.each([
    ['unissued state', (issued: IssuedState) => createRequest({ state: 'A'.repeat(43) }, issued)],
    [
      'wrong browser cookie',
      (issued: IssuedState) =>
        createRequest(
          {},
          issued,
          'https://app.example.com',
          `${issued.cookieName}=attacker-cookie`,
        ),
    ],
    [
      'wrong wallet subject',
      (issued: IssuedState) =>
        createRequest({ subject: '0x3333333333333333333333333333333333333333' }, issued),
    ],
    ['wrong chain', (issued: IssuedState) => createRequest({ chainId: linea.id + 1 }, issued)],
    ['wrong origin', (issued: IssuedState) => createRequest({}, issued, 'https://evil.example')],
    [
      'wrong deployment context',
      (issued: IssuedState) => {
        stateRecords.set(issued.stateHash, {
          ...stateRecords.get(issued.stateHash)!,
          record: { ...stateRecords.get(issued.stateHash)!.record, environment: 'deploy-preview' },
        });
        return createRequest({}, issued);
      },
    ],
    [
      'wrong redirect URI',
      (issued: IssuedState) => {
        stateRecords.set(issued.stateHash, {
          ...stateRecords.get(issued.stateHash)!,
          record: {
            ...stateRecords.get(issued.stateHash)!.record,
            redirectUri: 'https://evil.example',
          },
        });
        return createRequest({}, issued);
      },
    ],
  ])('rejects OAuth callback with %s before contacting Discord', async (_label, makeRequest) => {
    const response = await handler(makeRequest(issueState()), createContext());
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(http.post).not.toHaveBeenCalled();
  });

  it('rejects expired OAuth state before contacting Discord', async () => {
    const issued = issueState({ expiresAt: NOW - 1 });
    const response = await handler(createRequest({}, issued), createContext());
    expect(response.status).toBe(400);
    expect(http.post).not.toHaveBeenCalled();
  });

  it('paginates guilds and signs each validated guild with the production EIP-712 domain', async () => {
    const firstPage = Array.from({ length: 200 }, (_, index) => guild(String(index + 1)));
    const secondPage = [guild('201', 'Final guild')];
    vi.mocked(http.get).mockImplementation(
      async (_url, options) =>
        ({
          data: options?.params?.after === '200' ? secondPage : firstPage,
        }) as never,
    );

    const response = await handler(createRequest(), createContext());
    const body = (await response.json()) as {
      signedGuilds: Array<{ id: string; name: string; expirationDate: number; signature: Hex }>;
    };

    expect(response.status).toBe(200);
    expect(body.signedGuilds).toHaveLength(201);
    expect(http.get).toHaveBeenCalledTimes(2);
    expect(http.get).toHaveBeenNthCalledWith(
      2,
      GUILDS_URL,
      expect.objectContaining({ params: { limit: 200, after: '200' } }),
    );
    expect(http.post).toHaveBeenCalledWith(
      TOKEN_URL,
      expect.any(URLSearchParams),
      expect.objectContaining({ timeout: expect.any(Number) }),
    );

    const first = body.signedGuilds[0]!;
    await expect(
      verifyTypedData({
        address: SIGNER.address,
        domain: {
          name: 'VerifyDiscord',
          version: '1',
          chainId: linea.id,
          verifyingContract: getAddress(PORTAL_ID.toLowerCase()),
        },
        types: API_TYPES,
        primaryType: 'Discord',
        message: {
          id: BigInt(first.id),
          name: first.name,
          subject: SUBJECT,
          expirationDate: BigInt(first.expirationDate),
        },
        signature: first.signature,
      }),
    ).resolves.toBe(true);
  });

  it.each([
    ['not an array', { data: { guilds: [] } }],
    ['unsafe ID', { data: [guild('999999999999999999999999999')] }],
    ['missing name', { data: [{ id: '123' }] }],
    ['oversized name', { data: [guild('123', 'x'.repeat(101))] }],
  ])('rejects %s guild data before signing and returns a safe error', async (_label, result) => {
    vi.mocked(http.get).mockResolvedValue(result as never);

    const response = await handler(createRequest(), createContext());
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(502);
    expect(body).toEqual({ error: 'Invalid Discord guild response' });
    expect(JSON.stringify(body)).not.toContain('access-token');
  });

  it('maps provider timeouts and rate limits to bounded safe responses', async () => {
    vi.mocked(http.post).mockRejectedValueOnce({ code: 'ECONNABORTED', isAxiosError: true });
    const timeout = await handler(createRequest(), createContext('203.0.113.11'));
    expect(timeout.status).toBe(504);
    expect(await timeout.json()).toEqual({ error: 'Provider request timed out' });

    vi.mocked(http.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 429, headers: { 'retry-after': '20' } },
    });
    const limited = await handler(createRequest(), createContext('203.0.113.12'));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('20');
    expect(await limited.json()).toEqual({ error: 'Provider rate limited' });

    vi.mocked(http.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401 },
    });
    const expired = await handler(createRequest(), createContext('203.0.113.14'));
    expect(expired.status).toBe(401);
    expect(await expired.json()).toEqual({ error: 'Token expired' });
  });

  it('rejects an oversized request before token exchange', async () => {
    const request = new Request('https://functions.example.com/api', {
      method: 'POST',
      headers: { 'content-length': '9000', 'content-type': 'application/json' },
      body: '{}',
    });

    const response = await handler(request, createContext());
    expect(response.status).toBe(413);
    expect(http.post).not.toHaveBeenCalled();
    expect(http.get).not.toHaveBeenCalled();
  });

  it('bounds streamed bodies even when content-length is absent', async () => {
    const request = new Request('https://functions.example.com/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'x'.repeat(9_000), subject: SUBJECT, chainId: linea.id }),
    });

    const response = await handler(request, createContext('203.0.113.15'));
    expect(response.status).toBe(413);
    expect(http.post).not.toHaveBeenCalled();
  });

  it('accepts a large snowflake and ignores client-selected development redirects', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: [guild('99999999999999999999')] } as never);
    const valid = await handler(createRequest(), createContext('203.0.113.16'));
    expect(valid.status).toBe(200);

    const start = await handler(createStartRequest({ isDev: true }), createContext('203.0.113.17'));
    const body = (await start.json()) as { authorizeUrl: string };
    expect(new URL(body.authorizeUrl).searchParams.get('redirect_uri')).toBe(
      config.VITE_REDIRECT_URL,
    );
    expect(http.post).toHaveBeenCalledTimes(1);
  });

  it('uses the explicit local redirect only in a development configuration', async () => {
    const devHandler = createApiHandler({
      http,
      config: () => ({ ...config, NODE_ENV: 'development' }),
      oauthStateStore: () => stateStore,
      now: () => 1_800_000_000_000,
    });
    const response = await devHandler(
      createStartRequest({}, 'http://localhost:5173'),
      createContext('203.0.113.18'),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { authorizeUrl: string };
    expect(new URL(body.authorizeUrl).searchParams.get('redirect_uri')).toBe(
      'http://localhost:5173',
    );
  });

  it('completes a local callback using only its returned state and HttpOnly binding cookie', async () => {
    const devHandler = createApiHandler({
      http,
      config: () => ({ ...config, NODE_ENV: 'development' }),
      oauthStateStore: () => stateStore,
      now: () => NOW,
    });
    const start = await devHandler(
      createStartRequest({}, 'http://127.0.0.1:5173'),
      createContext('203.0.113.30'),
    );
    const { authorizeUrl } = (await start.json()) as { authorizeUrl: string };
    const authorize = new URL(authorizeUrl);
    const state = authorize.searchParams.get('state')!;
    const setCookie = start.headers.get('set-cookie')!;
    expect(setCookie).toMatch(/; Path=\/.netlify\/functions\/api; Max-Age=300/);
    const cookie = setCookie.split(';', 1)[0]!;
    const cookieName = cookie.split('=', 1)[0]!;
    const issued: IssuedState = {
      state,
      stateHash: hash(state),
      cookieName,
      cookie,
    };

    const exchange = await devHandler(
      createRequest({}, issued, 'http://localhost:5173'),
      createContext('203.0.113.31'),
    );

    expect(exchange.status).toBe(200);
    const params = vi.mocked(http.post).mock.calls.at(-1)?.[1] as URLSearchParams;
    expect(params.get('redirect_uri')).toBe('http://localhost:5173');
    expect(exchange.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('rejects invalid wallet and chain inputs before exchanging the OAuth code', async () => {
    for (const overrides of [{ subject: 'not-an-address' }, { chainId: 1 }, { code: '' }]) {
      const response = await handler(
        createRequest(overrides),
        createContext(`203.0.113.${20 + http.post.mock.calls.length}`),
      );
      expect(response.status).toBe(400);
    }
    expect(http.post).not.toHaveBeenCalled();
  });

  it('rejects more than 1,000 guilds before starting signing', async () => {
    let page = 0;
    vi.mocked(http.get).mockImplementation(async () => {
      page += 1;
      return {
        data: Array.from({ length: page <= 5 ? 200 : 1 }, (_, index) =>
          guild(String((page - 1) * 200 + index + 1)),
        ),
      } as never;
    });

    const response = await handler(createRequest(), createContext('203.0.113.19'));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: 'Guild limit exceeded' });
    expect(page).toBe(6);
  });

  it('rate limits a client after ten signing requests per minute', async () => {
    const ip = '203.0.113.13';
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await handler(createRequest(), createContext(ip))).status).toBe(200);
    }

    const limited = await handler(createRequest(), createContext(ip));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBeTruthy();
  });
});
