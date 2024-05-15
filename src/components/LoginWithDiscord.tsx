console.log('DISCORD_CLIENT_ID', import.meta.env.DISCORD_CLIENT_ID);

const CLIENT_ID = import.meta.env.DISCORD_CLIENT_ID;
const REDIRECT_URI = 'https://discord-attestation.netlify.app/.netlify/functions/api';
const SCOPE = 'identify guilds';
const DISCORD_OAUTH_URL = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${SCOPE}`;

const LoginWithDiscord = () => {
    const handleLogin = () => {
        // Store a flag in localStorage to indicate the OAuth process has started
        localStorage.setItem('discord_oauth_started', 'true');
        window.location.href = DISCORD_OAUTH_URL;
    };

    return (
        <button onClick={handleLogin}>Login with Discord</button>
    );
};

export default LoginWithDiscord;
