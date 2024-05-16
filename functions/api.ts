import axios from "axios";

const {VITE_DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, VITE_REDIRECT_URL} = process.env;
const DEV_REDIRECT_URL = 'http://localhost:5173';

export async function handler(event: {
    queryStringParameters: { code: string; method: string; isDev: string };
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

    if (!VITE_DISCORD_CLIENT_ID) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                message: "Discord client ID not set",
            }),
        };
    }

    if (!DISCORD_CLIENT_SECRET) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                message: "Discord client secret not set",
            }),
        };
    }

    if (!VITE_REDIRECT_URL) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                message: "Redirect URL not set",
            }),
        };
    }


    const {code, isDev} = event.queryStringParameters;
    const isDevBoolean = isDev === 'true';
    console.log('redirect_uri', isDevBoolean ? DEV_REDIRECT_URL : VITE_REDIRECT_URL)

    const params = new URLSearchParams();
    params.append('client_id', VITE_DISCORD_CLIENT_ID);
    params.append('client_secret', DISCORD_CLIENT_SECRET);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', isDevBoolean ? DEV_REDIRECT_URL : VITE_REDIRECT_URL);

    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', params);
        const {access_token} = tokenResponse.data;

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
