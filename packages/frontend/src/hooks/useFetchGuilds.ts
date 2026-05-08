import { useCallback, useEffect, useState } from 'react';
import type { DecodedPayload, SignedGuild } from '../types';
import type { Address, Hex } from 'viem';
import type { VeraxSdk } from '@verax-attestation-registry/verax-sdk';
import { PORTAL_ID, PORTAL_ID_TESTNET, SCHEMA_ID } from '../utils/constants';
import { linea } from 'wagmi/chains';
import { getLocalStorageValue, removeLocalStorageValue, STORAGE_KEYS } from '../utils/storage';

const LEGACY_DISCORD_TOKEN_KEY = 'discord_access_token';

const getApiBaseUrl = () => {
  const isLocalViteDevServer = import.meta.env.DEV && window.location.port === '5173';

  return import.meta.env.VITE_MODE === 'development' || isLocalViteDevServer
    ? 'http://localhost:8888'
    : '';
};

const getOAuthStateFromUrl = () => new URLSearchParams(window.location.search).get('state');

const isValidOAuthState = () => {
  const returnedState = getOAuthStateFromUrl();
  const storedState = getLocalStorageValue(STORAGE_KEYS.DISCORD_OAUTH_STATE);

  return Boolean(returnedState && storedState && returnedState === storedState);
};

const clearOAuthCodeFromUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
};

const getInitialOAuthLoadingState = (code?: string | null) => {
  if (!code) {
    return false;
  }

  return getLocalStorageValue(STORAGE_KEYS.DISCORD_OAUTH_STARTED) === 'true' && isValidOAuthState();
};

const clearStoredDiscordTokens = () => {
  removeLocalStorageValue(STORAGE_KEYS.DISCORD_ACCESS_TOKEN);

  try {
    window.localStorage.removeItem(LEGACY_DISCORD_TOKEN_KEY);
  } catch {
    // Ignore unavailable storage.
  }
};

export const useFetchGuilds = (
  veraxSdk?: VeraxSdk,
  address?: Address,
  code?: string | null,
  chainId?: number,
) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(() => getInitialOAuthLoadingState(code));
  const [guilds, setGuilds] = useState<SignedGuild[]>([]);

  const enrichGuildsWithAttestations = useCallback(
    async (signedGuilds: SignedGuild[], sdk: VeraxSdk): Promise<SignedGuild[]> => {
      const portalId = chainId === linea.id ? PORTAL_ID : PORTAL_ID_TESTNET;
      const attestedGuilds = await sdk.attestation.findBy(1000, 0, {
        schema: SCHEMA_ID,
        portal: portalId.toLowerCase(),
        subject: address,
      });

      const attestationIdByGuildId = new Map(
        attestedGuilds.flatMap((attested) => {
          const guildId = (attested.decodedPayload as DecodedPayload[])[0]?.guildId;
          return guildId ? [[guildId.toString(), attested.id as Hex]] : [];
        }),
      );

      return signedGuilds.map((guild: SignedGuild): SignedGuild => {
        const attestationId = attestationIdByGuildId.get(guild.id);
        return attestationId ? { ...guild, attestationId } : guild;
      });
    },
    [chainId, address],
  );

  const fetchGuildsFromApi = useCallback(
    async (params: { code: string }) => {
      const baseUrl = getApiBaseUrl();
      const isDev = baseUrl !== '';

      const payload = {
        isDev: String(isDev),
        subject: address as string,
        chainId: String(chainId),
        code: params.code,
      };

      try {
        const res = await fetch(`${baseUrl}/.netlify/functions/api`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (data.error || data.message) {
          return null;
        }

        return data.signedGuilds as SignedGuild[];
      } catch {
        return null;
      }
    },
    [address, chainId],
  );

  useEffect(() => {
    clearStoredDiscordTokens();
  }, []);

  useEffect(() => {
    if (!isLoading || !code || !veraxSdk) {
      return;
    }

    let isCurrent = true;

    const fetchGuilds = async () => {
      if (!isValidOAuthState()) {
        removeLocalStorageValue(STORAGE_KEYS.DISCORD_OAUTH_STARTED);
        removeLocalStorageValue(STORAGE_KEYS.DISCORD_OAUTH_STATE);
        clearOAuthCodeFromUrl();
        setIsLoading(false);
        return;
      }

      removeLocalStorageValue(STORAGE_KEYS.DISCORD_OAUTH_STARTED);
      try {
        const signedGuilds = await fetchGuildsFromApi({ code });
        if (signedGuilds && isCurrent) {
          const enrichedGuilds = await enrichGuildsWithAttestations(signedGuilds, veraxSdk);
          setGuilds(enrichedGuilds);
          setIsLoggedIn(true);
        }
      } finally {
        removeLocalStorageValue(STORAGE_KEYS.DISCORD_OAUTH_STATE);
        clearOAuthCodeFromUrl();
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    };

    void fetchGuilds();

    return () => {
      isCurrent = false;
    };
  }, [isLoading, code, veraxSdk, fetchGuildsFromApi, enrichGuildsWithAttestations]);

  useEffect(() => {
    if (code && !isLoading && !isValidOAuthState()) {
      removeLocalStorageValue(STORAGE_KEYS.DISCORD_OAUTH_STARTED);
      removeLocalStorageValue(STORAGE_KEYS.DISCORD_OAUTH_STATE);
      clearOAuthCodeFromUrl();
    }
  }, [code, isLoading]);

  return { isLoggedIn, isLoading, guilds, setGuilds };
};
