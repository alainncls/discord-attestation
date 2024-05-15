import axios from "axios";

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DEFAULT_REDIRECT_URL = 'http://localhost:5173';

export async function handler(event: {
    queryStringParameters: { code: string; method: string; isDev: boolean };
    body: string;
    httpMethod: string;
}) {

    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    };

    if (event.httpMethod == "OPTIONS") {
        return {
            statusCode: 204,
            headers,
            body: "",
        };
    }

    if (!DISCORD_CLIENT_ID) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Discord client ID not set",
            }),
        };
    }

    if (!DISCORD_CLIENT_SECRET) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Discord client secret not set",
            }),
        };
    }

    const {code, isDev} = event.queryStringParameters;
    const redirectUri = process.env.VITE_REDIRECT_URL ?? DEFAULT_REDIRECT_URL;

    const params = new URLSearchParams();
    params.append('client_id', DISCORD_CLIENT_ID);
    params.append('client_secret', DISCORD_CLIENT_SECRET);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', isDev ? DEFAULT_REDIRECT_URL : redirectUri);

    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', params);
        const {access_token} = tokenResponse.data;
        console.log('access_token', access_token);

        const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: {
                Authorization: `Bearer ${access_token}`
            }
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(guildsResponse.data)
        };
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.log('message', error.message);
            console.log('stack', error.stack);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({error: error.message})
            };
        } else {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({error: "An unknown error occurred"})
            };
        }
    }
}
