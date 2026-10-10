import { useCallback, useEffect, useState } from 'react';
import type { DecodedPayload, SignedGuild } from '../types';
import type { Address, Hex } from 'viem';
import type { VeraxSdk } from '@verax-attestation-registry/verax-sdk';
import { PORTAL_ID, PORTAL_ID_TESTNET, SCHEMA_ID } from '../utils/constants';
import { linea } from 'wagmi/chains';
import { removeLocalStorageValue, STORAGE_KEYS } from '../utils/storage';

const LEGACY_DISCORD_TOKEN_KEY = 'discord_access_token';

const getApiBaseUrl = () => {
  const isLocalViteDevServer = import.meta.env.DEV && window.location.port === '5173';

  return import.meta.env.VITE_MODE === 'development' || isLocalViteDevServer
    ? 'http://localhost:8888'
    : '';
};

const clearOAuthCodeFromUrl = (expectedCode: string, expectedState: string | null) => {
  const url = new URL(window.location.href);
  if (
    url.searchParams.get('code') !== expectedCode ||
    url.searchParams.get('state') !== expectedState
  ) {
    return;
  }
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
};

const getInitialOAuthLoadingState = (code?: string | null) => Boolean(code);

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
  state?: string | null,
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
    async (params: { code: string; state: string }, signal: AbortSignal) => {
      const baseUrl = getApiBaseUrl();

      const payload = {
        action: 'exchange',
        subject: address as string,
        chainId: String(chainId),
        code: params.code,
        state: params.state,
      };

      try {
        const res = await fetch(`${baseUrl}/.netlify/functions/api`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal,
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
    const controller = new AbortController();

    const fetchGuilds = async () => {
      if (!state) {
        clearOAuthCodeFromUrl(code, state ?? null);
        setIsLoading(false);
        return;
      }

      try {
        const signedGuilds = await fetchGuildsFromApi({ code, state }, controller.signal);
        if (signedGuilds && isCurrent) {
          const enrichedGuilds = await enrichGuildsWithAttestations(signedGuilds, veraxSdk);
          if (isCurrent) {
            setGuilds(enrichedGuilds);
            setIsLoggedIn(true);
          }
        }
      } finally {
        clearOAuthCodeFromUrl(code, state);
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    };

    void fetchGuilds();

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [isLoading, code, state, veraxSdk, fetchGuildsFromApi, enrichGuildsWithAttestations]);

  return { isLoggedIn, isLoading, guilds, setGuilds };
};
