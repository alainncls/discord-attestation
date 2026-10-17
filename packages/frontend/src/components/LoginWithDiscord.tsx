import { useEffect, useRef, useState } from 'react';
import './LoginWithDiscord.css';
import { DiscordIcon } from './icons';
import { linea, lineaSepolia } from 'wagmi/chains';

interface LoginWithDiscordProps {
  address?: `0x${string}`;
  chainId?: number;
  onAuthorize?: (url: string) => void;
}

const getApiBaseUrl = (): string => {
  const isLocalViteDevServer = import.meta.env.DEV && window.location.port === '5173';
  return import.meta.env.VITE_MODE === 'development' || isLocalViteDevServer
    ? 'http://localhost:8888'
    : '';
};

const LoginWithDiscord = ({ address, chainId, onAuthorize }: LoginWithDiscordProps) => {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string>();
  const startController = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      startController.current?.abort();
    },
    [address, chainId],
  );

  const handleLogin = async () => {
    if (!address || !chainId) return;
    const controller = new AbortController();
    startController.current = controller;
    setIsStarting(true);
    setError(undefined);
    try {
      const response = await fetch(`${getApiBaseUrl()}/.netlify/functions/api`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', subject: address, chainId: String(chainId) }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const data: unknown = await response.json();
      const authorizeUrl =
        typeof data === 'object' && data !== null && 'authorizeUrl' in data
          ? data.authorizeUrl
          : undefined;
      if (!response.ok || typeof authorizeUrl !== 'string') {
        throw new Error('Discord login failed. Try again.');
      }

      const target = new URL(authorizeUrl);
      if (target.origin !== 'https://discord.com' || target.pathname !== '/api/oauth2/authorize') {
        throw new Error('Invalid Discord authorization URL.');
      }
      (onAuthorize ?? ((url: string) => window.location.assign(url)))(target.toString());
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'Discord login failed. Try again.');
    } finally {
      setIsStarting(false);
      if (startController.current === controller) startController.current = null;
    }
  };

  const isSupportedChain = chainId === linea.id || chainId === lineaSepolia.id;

  return (
    <div className="login-container">
      <button
        type="button"
        className="btn btn-primary btn-large"
        onClick={() => void handleLogin()}
        disabled={!address || !isSupportedChain || isStarting}
        aria-busy={isStarting}
      >
        <DiscordIcon size={20} aria-hidden="true" />
        <span>{isStarting ? 'Redirecting…' : 'Connect Discord'}</span>
      </button>
      {error ? (
        <p className="login-error" role="alert">
          {error}
        </p>
      ) : null}
      {!address || !isSupportedChain ? (
        <p className="login-hint" role="status">
          Connect a Linea wallet first.
        </p>
      ) : null}
    </div>
  );
};

export default LoginWithDiscord;
