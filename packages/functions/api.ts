import axios from 'axios';
import { Guild, SignedGuild } from '../frontend/src/types';
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

export async function handler(event: {
  queryStringParameters: {
    code: string;
    method: string;
    isDev: string;
    subject: string;
  };
  body: string;
  httpMethod: string;
}) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod == 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: '',
    };
  }

  if (!VITE_DISCORD_CLIENT_ID) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'Discord client ID not set',
      }),
    };
  }

  if (!DISCORD_CLIENT_SECRET) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'Discord client secret not set',
      }),
    };
  }

  if (!VITE_REDIRECT_URL) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'Redirect URL not set',
      }),
    };
  }

  if (!SIGNER_PRIVATE_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'Private key not set',
      }),
    };
  }

  const { code, isDev, subject } = event.queryStringParameters;
  const isDevBoolean = isDev === 'true';

  const params = new URLSearchParams();
  params.append('client_id', VITE_DISCORD_CLIENT_ID);
  params.append('client_secret', DISCORD_CLIENT_SECRET);
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append(
    'redirect_uri',
    isDevBoolean ? DEV_REDIRECT_URL : VITE_REDIRECT_URL,
  );

  try {
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      params,
    );
    const { access_token } = tokenResponse.data;

    const guildsResponse = await axios.get(
      'https://discord.com/api/users/@me/guilds',
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      },
    );

    const walletClient = createWalletClient({
      account: privateKeyToAccount(SIGNER_PRIVATE_KEY as Hex),
      transport: http('https://rpc.linea.build'),
    });

    const promiseSignedGuilds: Promise<SignedGuild>[] = (
      guildsResponse.data as Guild[]
    ).map(async (guild) => {
      const signature: Hex = await walletClient.signMessage({
        account: walletClient.account,
        message: guild.id,
      });

      return {
        id: guild.id,
        name: guild.name,
        signature,
      };
    });

    const signedGuilds: SignedGuild[] = await Promise.all(promiseSignedGuilds);

    const subjectSignature: Hex = await walletClient.signMessage({
      account: walletClient.account,
      message: subject,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ signedGuilds, subjectSignature }),
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message }),
      };
    } else {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'An unknown error occurred' }),
      };
    }
  }
}
