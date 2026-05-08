import './LoginWithDiscord.css';
import { setLocalStorageValue, STORAGE_KEYS } from '../utils/storage';
import { DiscordIcon } from './icons';

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URL;
const SCOPE = 'identify guilds';

const createOAuthState = () => {
  if (typeof window.crypto?.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  const stateBytes = new Uint32Array(4);
  window.crypto.getRandomValues(stateBytes);
  return Array.from(stateBytes, (value) => value.toString(16).padStart(8, '0')).join('');
};

const LoginWithDiscord = () => {
  const handleLogin = () => {
    const state = createOAuthState();
    const oauthUrl = new URL('https://discord.com/api/oauth2/authorize');

    oauthUrl.searchParams.set('client_id', CLIENT_ID);
    oauthUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('scope', SCOPE);
    oauthUrl.searchParams.set('state', state);

    setLocalStorageValue(STORAGE_KEYS.DISCORD_OAUTH_STATE, state);
    setLocalStorageValue(STORAGE_KEYS.DISCORD_OAUTH_STARTED, 'true');
    window.location.href = oauthUrl.toString();
  };

  return (
    <div className="login-container">
      <button type="button" className="discord-btn" onClick={handleLogin}>
        <DiscordIcon size={24} aria-hidden="true" />
        <span>Login with Discord</span>
      </button>
    </div>
  );
};

export default LoginWithDiscord;
