import axios from 'axios';
import { Guild } from '../frontend/src/types';
import { createWalletClient, Hex, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from 'dotenv';

config({ path: '.env' });

const {
  VITE_DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  VITE_REDIRECT_URL,
  SIGNER_PRIVATE_KEY,
} = process.env;
const DEV_REDIRECT_URL = 'http://localhost:5173';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const checkConfig = () => {
  if (!VITE_DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !VITE_REDIRECT_URL || !SIGNER_PRIVATE_KEY) {
    throw new Error('Configuration not set');
  }
};

const getToken = async (code: string, isDev: boolean) => {
  const params = new URLSearchParams({
    client_id: VITE_DISCORD_CLIENT_ID!,
    client_secret: DISCORD_CLIENT_SECRET!,
    grant_type: 'authorization_code',
    code,
    redirect_uri: isDev ? DEV_REDIRECT_URL : VITE_REDIRECT_URL!,
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

const signGuilds = async (guilds: Guild[], walletClient: ReturnType<typeof createWalletClient>) => {
  return Promise.all(guilds.map(async (guild) => {
    const signature: Hex = await walletClient.signMessage({
      account: walletClient.account,
      message: guild.id,
    });
    return { id: guild.id, name: guild.name, signature };
  }));
};

const signSubject = async (subject: string, walletClient: ReturnType<typeof createWalletClient>) => {
  return walletClient.signMessage({
    account: walletClient.account,
    message: subject,
  });
};

export async function handler(event: {
  queryStringParameters: { code: string; isDev: string; subject: string };
  body: string;
  httpMethod: string;
}) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    checkConfig();

    const { code, isDev, subject } = event.queryStringParameters;
    const isDevBoolean = isDev === 'true';

    const accessToken = await getToken(code, isDevBoolean);
    const guilds = await getGuilds(accessToken);

    const walletClient = createWalletClient({
      account: privateKeyToAccount(SIGNER_PRIVATE_KEY as Hex),
      transport: http('https://rpc.linea.build'),
    });

    const signedGuilds = await signGuilds(guilds, walletClient);
    const subjectSignature = await signSubject(subject, walletClient);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ signedGuilds, subjectSignature }),
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: errorMessage }),
    };
  }
}
