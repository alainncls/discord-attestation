import axios from 'axios';
import type { Guild } from './lib/types';
import { createWalletClient, getAddress, http, isAddress } from 'viem';
import type { Address, Hex, WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { linea, lineaSepolia } from 'viem/chains';
import { PORTAL_ID, PORTAL_ID_TESTNET } from './lib/constants';

const { VITE_DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, VITE_REDIRECT_URL, SIGNER_PRIVATE_KEY } =
  process.env;
const DEV_REDIRECT_URL = 'http://localhost:5173';
const ATTESTATION_VALIDITY_SECONDS = 30 * 24 * 60 * 60;
const SUPPORTED_CHAIN_IDS: ReadonlySet<number> = new Set([linea.id, lineaSepolia.id]);

const getHeaders = (req: Request) => {
  const origin = req.headers.get('origin');
  const allowedOrigins = new Set(
    [VITE_REDIRECT_URL, DEV_REDIRECT_URL, 'http://127.0.0.1:5173'].filter(Boolean),
  );
  const allowedOrigin =
    origin && allowedOrigins.has(origin) ? origin : (VITE_REDIRECT_URL ?? DEV_REDIRECT_URL);

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
};

interface ApiPayload {
  code?: unknown;
  isDev?: unknown;
  subject?: unknown;
  chainId?: unknown;
}

const checkConfig = () => {
  if (
    !VITE_DISCORD_CLIENT_ID ||
    !DISCORD_CLIENT_SECRET ||
    !VITE_REDIRECT_URL ||
    !SIGNER_PRIVATE_KEY
  ) {
    throw new Error('Configuration not set');
  }
};

const getToken = async (code: string, isDev: boolean) => {
  const params = new URLSearchParams({
    client_id: VITE_DISCORD_CLIENT_ID ?? '',
    client_secret: DISCORD_CLIENT_SECRET ?? '',
    grant_type: 'authorization_code',
    code,
    redirect_uri: isDev ? DEV_REDIRECT_URL : (VITE_REDIRECT_URL ?? ''),
  });

  const response = await axios.post('https://discord.com/api/oauth2/token', params);
  return response.data.access_token;
};

const getGuilds = async (accessToken: string) => {
  const response = await axios.get('https://discord.com/api/users/@me/guilds', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data as Guild[];
};

const getRequestPayload = async (req: Request): Promise<ApiPayload | null> => {
  try {
    const payload = (await req.json()) as unknown;
    return payload && typeof payload === 'object' ? (payload as ApiPayload) : null;
  } catch {
    return null;
  }
};

const parseCode = (value: unknown) =>
  typeof value === 'string' && value.length > 0 ? value : null;

const parseSubject = (value: unknown): Address | null => {
  if (typeof value !== 'string' || !isAddress(value)) {
    return null;
  }

  return getAddress(value);
};

const parseSupportedChainId = (value: unknown) => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const chainIdValue = String(value);
  if (!/^\d+$/.test(chainIdValue)) {
    return null;
  }

  const chainId = Number(chainIdValue);
  return SUPPORTED_CHAIN_IDS.has(chainId) ? chainId : null;
};

const signGuilds = async (
  walletClient: WalletClient,
  guilds: Guild[],
  subject: Address,
  chainId: number,
  expirationDate: bigint,
) => {
  const domain = {
    name: 'VerifyDiscord',
    version: '1',
    chainId,
    verifyingContract: chainId === linea.id ? PORTAL_ID : PORTAL_ID_TESTNET,
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

  if (!account) {
    throw new Error('Signer account not found');
  }

  return Promise.all(
    guilds.map(async (guild) => {
      const message = {
        id: BigInt(guild.id),
        name: guild.name,
        subject,
        expirationDate,
      };

      const signature = await walletClient.signTypedData({
        account,
        domain,
        types,
        primaryType: 'Discord',
        message,
      });

      return {
        id: guild.id,
        name: guild.name,
        signature,
        expirationDate: Number(expirationDate),
      };
    }),
  );
};

export default async (req: Request) => {
  const headers = getHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  try {
    checkConfig();

    const payload = await getRequestPayload(req);
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers,
      });
    }

    const code = parseCode(payload.code);
    const isDev = payload.isDev === true || payload.isDev === 'true';
    const subject = parseSubject(payload.subject);
    const chainId = parseSupportedChainId(payload.chainId);

    if (!code || !subject || !chainId) {
      return new Response(JSON.stringify({ error: 'Missing parameters' }), {
        status: 400,
        headers,
      });
    }

    const accessToken = await getToken(code, isDev);

    let guilds: Guild[];
    try {
      guilds = await getGuilds(accessToken);
    } catch (error) {
      // Token expired or invalid - clear it on client side
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        return new Response(JSON.stringify({ error: 'Token expired', tokenExpired: true }), {
          status: 401,
          headers,
        });
      }
      throw error;
    }

    const expirationDate = BigInt(Math.floor(Date.now() / 1000) + ATTESTATION_VALIDITY_SECONDS);

    const walletClient = createWalletClient({
      account: privateKeyToAccount(SIGNER_PRIVATE_KEY as Hex),
      transport: http('https://rpc.linea.build'),
    });

    const signedGuilds = await signGuilds(walletClient, guilds, subject, chainId, expirationDate);

    return new Response(JSON.stringify({ signedGuilds }), {
      status: 200,
      headers,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers,
    });
  }
};
