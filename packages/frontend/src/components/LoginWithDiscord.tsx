import { FaDiscord } from 'react-icons/fa';
import './LoginWithDiscord.css';
import { setLocalStorageValue, STORAGE_KEYS } from '../utils/storage';

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URL;
const SCOPE = 'identify guilds';
const DISCORD_OAUTH_URL = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${SCOPE}`;

const LoginWithDiscord = () => {
  const handleLogin = () => {
    setLocalStorageValue(STORAGE_KEYS.DISCORD_OAUTH_STARTED, 'true');
    window.location.href = DISCORD_OAUTH_URL;
  };

  return (
    <div className="login-container">
      <button type="button" className="discord-btn" onClick={handleLogin}>
        <FaDiscord size={24} aria-hidden="true" />
        <span>Login with Discord</span>
      </button>
    </div>
  );
};

export default LoginWithDiscord;
