import type { AxiosInstance } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress, verifyTypedData, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { linea } from 'viem/chains';
import { createApiHandler } from '../api';
import { PORTAL_ID } from '../lib/constants';

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
};

const http = {
  get: vi.fn(),
  post: vi.fn(),
} as unknown as AxiosInstance;

const createRequest = (overrides: Record<string, unknown> = {}) =>
  new Request('https://functions.example.com/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'oauth-code', subject: SUBJECT, chainId: linea.id, ...overrides }),
  });

const createContext = (ip = '203.0.113.10') => ({ ip }) as never;

const guild = (id: string, name = `Guild ${id}`) => ({ id, name });

describe('Discord signing API', () => {
  let handler: ReturnType<typeof createApiHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(http.post).mockResolvedValue({ data: { access_token: 'access-token' } } as never);
    vi.mocked(http.get).mockResolvedValue({ data: [guild('123')] } as never);
    handler = createApiHandler({ http, config: () => config, now: () => 1_800_000_000_000 });
  });

  afterEach(() => vi.restoreAllMocks());

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

  it('accepts a large snowflake as a decimal string and restricts development redirects', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: [guild('99999999999999999999')] } as never);
    const valid = await handler(createRequest(), createContext('203.0.113.16'));
    expect(valid.status).toBe(200);

    const devAttempt = await handler(createRequest({ isDev: true }), createContext('203.0.113.17'));
    expect(devAttempt.status).toBe(400);
    expect(http.post).toHaveBeenCalledTimes(1);
  });

  it('uses the explicit local redirect only in a development configuration', async () => {
    const devHandler = createApiHandler({
      http,
      config: () => ({ ...config, NODE_ENV: 'development' }),
      now: () => 1_800_000_000_000,
    });
    const response = await devHandler(
      createRequest({ isDev: true }),
      createContext('203.0.113.18'),
    );

    expect(response.status).toBe(200);
    const params = vi.mocked(http.post).mock.calls.at(-1)?.[1] as URLSearchParams;
    expect(params.get('redirect_uri')).toBe('http://localhost:5173');
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
