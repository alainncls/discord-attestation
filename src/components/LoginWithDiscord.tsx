import {FaDiscord} from "react-icons/fa";
import './LoginWithDiscord.css';

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;
const REDIRECT_URI = 'http://localhost:5173';
const SCOPE = 'identify guilds';
const DISCORD_OAUTH_URL = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${SCOPE}`;

const LoginWithDiscord = () => {
    const handleLogin = () => {
        localStorage.setItem('discord_oauth_started', 'true');
        window.location.href = DISCORD_OAUTH_URL;
    };

    return (
        <button className="btn" onClick={handleLogin}>
            <FaDiscord size={24}/> Login with Discord
        </button>
    );
};

export default LoginWithDiscord;
