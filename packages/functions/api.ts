import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { Context } from '@netlify/functions';
import { createWalletClient, getAddress, http, isAddress } from 'viem';
import type { Address, Hex, WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { linea, lineaSepolia } from 'viem/chains';
import { PORTAL_ID, PORTAL_ID_TESTNET } from './lib/constants';
import type { Guild } from './lib/types';

const TOKEN_URL = 'https://discord.com/api/oauth2/token';
const GUILDS_URL = 'https://discord.com/api/users/@me/guilds';
const DEV_REDIRECT_URL = 'http://localhost:5173';
const ATTESTATION_VALIDITY_SECONDS = 30 * 24 * 60 * 60;
const SUPPORTED_CHAIN_IDS: ReadonlySet<number> = new Set([linea.id, lineaSepolia.id]);
const MAX_REQUEST_BODY_BYTES = 8 * 1024;
const MAX_PROVIDER_BODY_BYTES = 2 * 1024 * 1024;
const PROVIDER_TIMEOUT_MS = 5_000;
const PAGE_SIZE = 200;
const MAX_GUILDS = 1_000;
const SIGNING_CONCURRENCY = 10;
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_CLIENTS = 4_096;

interface RuntimeConfig {
  VITE_DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  VITE_REDIRECT_URL?: string;
  SIGNER_PRIVATE_KEY?: string;
  NODE_ENV?: string;
}

interface ApiDependencies {
  http: Pick<AxiosInstance, 'get' | 'post'>;
  config: () => RuntimeConfig;
  now?: () => number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly publicMessage: string,
    readonly retryAfter?: string,
  ) {
    super(publicMessage);
    this.name = 'ApiError';
  }
}

const getHeaders = (req: Request, config: RuntimeConfig): Record<string, string> => {
  const origin = req.headers.get('origin');
  const configuredOrigin = config.VITE_REDIRECT_URL;
  const allowedOrigins = new Set(
    [configuredOrigin, DEV_REDIRECT_URL, 'http://127.0.0.1:5173'].filter(Boolean),
  );
  const allowedOrigin =
    origin && allowedOrigins.has(origin) ? origin : (configuredOrigin ?? DEV_REDIRECT_URL);

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
};

const jsonResponse = (
  body: unknown,
  status: number,
  headers: Record<string, string>,
  retryAfter?: string,
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...Object.fromEntries(new Headers(headers)),
      ...(retryAfter ? { 'Retry-After': retryAfter } : {}),
    },
  });

const readRequestJson = async (req: Request): Promise<Record<string, unknown>> => {
  const declaredLength = req.headers.get('content-length');
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength) || !Number.isSafeInteger(Number(declaredLength))) {
      throw new ApiError(400, 'Invalid content length');
    }
    if (Number(declaredLength) > MAX_REQUEST_BODY_BYTES) {
      await req.body?.cancel().catch(() => undefined);
      throw new ApiError(413, 'Request body too large');
    }
  }

  if (!req.body) throw new ApiError(400, 'Invalid JSON body');

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      byteLength += value.byteLength;
      if (byteLength > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new ApiError(413, 'Request body too large');
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // The reader may already have released its lock after cancellation.
    }
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new ApiError(400, 'Invalid JSON body');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApiError(400, 'Invalid JSON body');
  }
  return value as Record<string, unknown>;
};

const getProviderStatus = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null || !('response' in error)) return undefined;
  const response = error.response;
  if (typeof response !== 'object' || response === null || !('status' in response))
    return undefined;
  return typeof response.status === 'number' ? response.status : undefined;
};

const getProviderRetryAfter = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('response' in error)) return undefined;
  const response = error.response;
  if (typeof response !== 'object' || response === null || !('headers' in response)) {
    return undefined;
  }
  const headers = response.headers;
  if (typeof headers !== 'object' || headers === null || !('retry-after' in headers)) {
    return undefined;
  }
  const value = headers['retry-after'];
  return typeof value === 'string' ? value : undefined;
};

const isProviderTimeout = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (('code' in error && error.code === 'ECONNABORTED') ||
    ('name' in error && (error.name === 'TimeoutError' || error.name === 'AbortError')));

const mapProviderError = (error: unknown): ApiError => {
  if (isProviderTimeout(error)) return new ApiError(504, 'Provider request timed out');
  const status = getProviderStatus(error);
  if (status === 401) return new ApiError(401, 'Token expired', undefined);
  if (status === 429) {
    return new ApiError(429, 'Provider rate limited', getProviderRetryAfter(error) ?? '60');
  }
  return new ApiError(502, 'Provider request failed');
};

const createRateLimiter = (now: () => number) => {
  const entries = new Map<string, RateLimitEntry>();

  return (key: string): number | null => {
    const currentTime = now();
    for (const [client, entry] of entries) {
      if (entry.resetAt <= currentTime) entries.delete(client);
    }

    let entry = entries.get(key);
    if (!entry) {
      if (entries.size >= RATE_LIMIT_MAX_CLIENTS) {
        const oldest = entries.keys().next().value as string | undefined;
        if (oldest) entries.delete(oldest);
      }
      entry = { count: 0, resetAt: currentTime + RATE_LIMIT_WINDOW_MS };
      entries.set(key, entry);
    }

    entry.count += 1;
    return entry.count > RATE_LIMIT_MAX
      ? Math.max(1, Math.ceil((entry.resetAt - currentTime) / 1000))
      : null;
  };
};

const parseCode = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 && value.length <= 2_048 ? value : null;

const parseSubject = (value: unknown): Address | null => {
  if (typeof value !== 'string' || !isAddress(value)) return null;
  return getAddress(value);
};

const parseSupportedChainId = (value: unknown): number | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const chainIdValue = String(value);
  if (!/^\d+$/.test(chainIdValue)) return null;
  const chainId = Number(chainIdValue);
  return Number.isSafeInteger(chainId) && SUPPORTED_CHAIN_IDS.has(chainId) ? chainId : null;
};

const checkConfig: (config: RuntimeConfig) => asserts config is RuntimeConfig & {
  VITE_DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  VITE_REDIRECT_URL: string;
  SIGNER_PRIVATE_KEY: Hex;
} = (config) => {
  if (
    !config.VITE_DISCORD_CLIENT_ID ||
    !config.DISCORD_CLIENT_SECRET ||
    !config.VITE_REDIRECT_URL ||
    !config.SIGNER_PRIVATE_KEY
  ) {
    throw new ApiError(500, 'Configuration not set');
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(config.SIGNER_PRIVATE_KEY)) {
    throw new ApiError(500, 'Configuration is invalid');
  }
};

const getToken = async (
  client: ApiDependencies['http'],
  config: RuntimeConfig & {
    VITE_DISCORD_CLIENT_ID: string;
    DISCORD_CLIENT_SECRET: string;
    VITE_REDIRECT_URL: string;
  },
  code: string,
  isDev: boolean,
): Promise<string> => {
  const params = new URLSearchParams({
    client_id: config.VITE_DISCORD_CLIENT_ID,
    client_secret: config.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: isDev ? DEV_REDIRECT_URL : config.VITE_REDIRECT_URL,
  });

  let response;
  try {
    response = await client.post(TOKEN_URL, params, {
      timeout: PROVIDER_TIMEOUT_MS,
      maxBodyLength: MAX_REQUEST_BODY_BYTES,
      maxContentLength: MAX_PROVIDER_BODY_BYTES,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  } catch (error) {
    throw mapProviderError(error);
  }

  const accessToken = response.data?.access_token;
  if (typeof accessToken !== 'string' || accessToken.length === 0 || accessToken.length > 8_192) {
    throw new ApiError(502, 'Invalid Discord token response');
  }
  return accessToken;
};

const validateGuilds = (value: unknown): Guild[] => {
  if (!Array.isArray(value)) throw new ApiError(502, 'Invalid Discord guild response');
  const guilds: Guild[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new ApiError(502, 'Invalid Discord guild response');
    }
    const candidate = item as { id?: unknown; name?: unknown };
    if (
      typeof candidate.id !== 'string' ||
      !/^\d{1,20}$/.test(candidate.id) ||
      BigInt(candidate.id) <= 0n ||
      typeof candidate.name !== 'string' ||
      candidate.name.length === 0 ||
      candidate.name.length > 100 ||
      seen.has(candidate.id)
    ) {
      throw new ApiError(502, 'Invalid Discord guild response');
    }
    seen.add(candidate.id);
    guilds.push({ id: candidate.id, name: candidate.name });
  }
  return guilds;
};

const getGuilds = async (
  client: ApiDependencies['http'],
  accessToken: string,
): Promise<Guild[]> => {
  const guilds: Guild[] = [];
  const seen = new Set<string>();
  let after: string | undefined;

  for (let page = 0; page <= Math.ceil(MAX_GUILDS / PAGE_SIZE); page += 1) {
    let response;
    try {
      response = await client.get(GUILDS_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { limit: PAGE_SIZE, ...(after ? { after } : {}) },
        timeout: PROVIDER_TIMEOUT_MS,
        maxContentLength: MAX_PROVIDER_BODY_BYTES,
      });
    } catch (error) {
      throw mapProviderError(error);
    }

    const nextPage = validateGuilds(response.data);
    if (nextPage.length > MAX_GUILDS - guilds.length) {
      throw new ApiError(422, 'Guild limit exceeded');
    }
    if (nextPage.some(({ id }) => seen.has(id))) {
      throw new ApiError(502, 'Invalid Discord guild response');
    }
    for (const guild of nextPage) {
      seen.add(guild.id);
      guilds.push(guild);
    }

    if (nextPage.length < PAGE_SIZE) return guilds;
    after = nextPage.at(-1)?.id;
  }

  throw new ApiError(422, 'Guild limit exceeded');
};

const signGuilds = async (
  walletClient: WalletClient,
  guilds: Guild[],
  subject: Address,
  chainId: number,
  expirationDate: bigint,
): Promise<Array<{ id: string; name: string; signature: Hex; expirationDate: number }>> => {
  const domain = {
    name: 'VerifyDiscord',
    version: '1',
    chainId,
    verifyingContract: getAddress(
      (chainId === linea.id ? PORTAL_ID : PORTAL_ID_TESTNET).toLowerCase(),
    ),
  } as const;
  const types = {
    Discord: [
      { name: 'id', type: 'uint256' },
      { name: 'name', type: 'string' },
      { name: 'subject', type: 'address' },
      { name: 'expirationDate', type: 'uint64' },
    ],
  } as const;
  const account = walletClient.account;
  if (!account) throw new ApiError(500, 'Signer account not found');

  const signed = new Array<{
    id: string;
    name: string;
    signature: Hex;
    expirationDate: number;
  }>(guilds.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < guilds.length) {
      const index = nextIndex;
      nextIndex += 1;
      const guild = guilds[index]!;
      const signature = await walletClient.signTypedData({
        account,
        domain,
        types,
        primaryType: 'Discord',
        message: {
          id: BigInt(guild.id),
          name: guild.name,
          subject,
          expirationDate,
        },
      });
      signed[index] = {
        id: guild.id,
        name: guild.name,
        signature,
        expirationDate: Number(expirationDate),
      };
    }
  };

  await Promise.all(Array.from({ length: Math.min(SIGNING_CONCURRENCY, guilds.length) }, worker));
  return signed;
};

const createDefaultConfig = (): RuntimeConfig => ({
  VITE_DISCORD_CLIENT_ID: process.env.VITE_DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
  VITE_REDIRECT_URL: process.env.VITE_REDIRECT_URL,
  SIGNER_PRIVATE_KEY: process.env.SIGNER_PRIVATE_KEY,
  NODE_ENV: process.env.NODE_ENV,
});

export const createApiHandler = (dependencies: ApiDependencies) => {
  const now = dependencies.now ?? Date.now;
  const rateLimit = createRateLimiter(now);

  return async (req: Request, context?: Context): Promise<Response> => {
    const config = dependencies.config();
    const headers = getHeaders(req, config);

    if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, headers);

    const waitSeconds = rateLimit(context?.ip ?? 'unknown');
    if (waitSeconds !== null) {
      return jsonResponse({ error: 'Too many requests' }, 429, headers, String(waitSeconds));
    }

    try {
      checkConfig(config);
      const payload = await readRequestJson(req);
      const code = parseCode(payload.code);
      const subject = parseSubject(payload.subject);
      const chainId = parseSupportedChainId(payload.chainId);
      const requestedDevRedirect = payload.isDev === true || payload.isDev === 'true';
      const isDev = requestedDevRedirect && config.NODE_ENV === 'development';

      if (!code || !subject || !chainId) throw new ApiError(400, 'Missing parameters');
      if (requestedDevRedirect && !isDev) throw new ApiError(400, 'Invalid development redirect');

      const accessToken = await getToken(dependencies.http, config, code, isDev);
      let guilds: Guild[];
      try {
        guilds = await getGuilds(dependencies.http, accessToken);
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw mapProviderError(error);
      }

      const expirationDate = BigInt(Math.floor(now() / 1000) + ATTESTATION_VALIDITY_SECONDS);
      const walletClient = createWalletClient({
        account: privateKeyToAccount(config.SIGNER_PRIVATE_KEY),
        transport: http('https://rpc.linea.build'),
      });
      const signedGuilds = await signGuilds(walletClient, guilds, subject, chainId, expirationDate);

      return jsonResponse({ signedGuilds }, 200, headers);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        return jsonResponse(
          { error: error.publicMessage },
          error.status,
          headers,
          error.retryAfter,
        );
      }
      return jsonResponse({ error: 'Signing failed' }, 500, headers);
    }
  };
};

export default createApiHandler({
  http: axios,
  config: createDefaultConfig,
});
