import axios from 'axios';
import type { Guild } from './lib/types';
import { createWalletClient, http } from 'viem';
import type { Hex, WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { linea } from 'viem/chains';
import { PORTAL_ID, PORTAL_ID_TESTNET } from './lib/constants';
import type { Context } from '@netlify/functions';

const { VITE_DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, VITE_REDIRECT_URL, SIGNER_PRIVATE_KEY } =
  process.env;
const DEV_REDIRECT_URL = 'http://localhost:5173';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

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

const signGuilds = async (
  walletClient: WalletClient,
  guilds: Guild[],
  subject: string,
  chainId: number,
) => {
  const domain = {
    name: 'VerifyDiscord',
    version: '1',
    chainId: chainId,
    verifyingContract: chainId === linea.id ? PORTAL_ID : PORTAL_ID_TESTNET,
  } as const;

  const types = {
    Discord: [
      { name: 'id', type: 'uint256' },
      { name: 'subject', type: 'address' },
    ],
  };

  const account = walletClient.account;

  if (!account) {
    throw new Error('Signer account not found');
  }

  return Promise.all(
    guilds.map(async (guild) => {
      const message = {
        id: BigInt(guild.id),
        subject,
      };

      const signature = await walletClient.signTypedData({
        account,
        domain,
        types,
        primaryType: 'Discord',
        message,
      });

      return { id: guild.id, name: guild.name, signature };
    }),
  );
};

export default async (req: Request, context: Context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers });
  }

  try {
    checkConfig();

    const { searchParams } = context.url;
    const code = searchParams.get('code');
    const existingToken = searchParams.get('accessToken');
    const isDev = searchParams.get('isDev') === 'true';
    const subject = searchParams.get('subject');
    const rawChainId = searchParams.get('chainId');

    if ((!code && !existingToken) || !subject || !rawChainId) {
      return new Response(JSON.stringify({ error: 'Missing parameters' }), {
        status: 400,
        headers,
      });
    }

    const chainId = parseInt(rawChainId, 10);

    // Use existing token or exchange OAuth code for a new one
    const accessToken = existingToken ?? (await getToken(code as string, isDev));

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

    const walletClient = createWalletClient({
      account: privateKeyToAccount(SIGNER_PRIVATE_KEY as Hex),
      transport: http('https://rpc.linea.build'),
    });

    const signedGuilds = await signGuilds(walletClient, guilds, subject, chainId);

    return new Response(JSON.stringify({ signedGuilds, accessToken }), {
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
