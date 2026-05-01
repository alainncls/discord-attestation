import { useCallback, useEffect, useRef, useState } from 'react';
import type { DecodedPayload, SignedGuild } from '../types';
import type { Address, Hex } from 'viem';
import { VeraxSdk } from '@verax-attestation-registry/verax-sdk';
import { PORTAL_ID, PORTAL_ID_TESTNET, SCHEMA_ID } from '../utils/constants';
import { linea } from 'wagmi/chains';
import {
  migrateLocalStorageValue,
  removeLocalStorageValue,
  setLocalStorageValue,
  STORAGE_KEYS,
} from '../utils/storage';

const LEGACY_DISCORD_TOKEN_KEY = 'discord_access_token';
const LEGACY_DISCORD_OAUTH_STARTED_KEY = 'discord_oauth_started';

const getApiBaseUrl = () =>
  import.meta.env.VITE_MODE === 'development'
    ? 'http://localhost:8888'
    : 'https://discord.alainnicolas.fr';

export const useFetchGuilds = (
  veraxSdk?: VeraxSdk,
  address?: Address,
  code?: string | null,
  chainId?: number,
) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [guilds, setGuilds] = useState<SignedGuild[]>([]);
  const hasRestoredSession = useRef(false);

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
    async (params: { code?: string; accessToken?: string }) => {
      const baseUrl = getApiBaseUrl();
      const isDev = import.meta.env.VITE_MODE === 'development';

      const searchParams = new URLSearchParams({
        isDev: String(isDev),
        subject: address as string,
        chainId: String(chainId),
      });

      if (params.code) {
        searchParams.set('code', params.code);
      }
      if (params.accessToken) {
        searchParams.set('accessToken', params.accessToken);
      }

      try {
        const res = await fetch(`${baseUrl}/.netlify/functions/api?${searchParams}`);
        const data = await res.json();

        if (data.tokenExpired) {
          removeLocalStorageValue(STORAGE_KEYS.DISCORD_ACCESS_TOKEN);
          return null;
        }

        if (data.error || data.message) {
          if (params.accessToken) {
            removeLocalStorageValue(STORAGE_KEYS.DISCORD_ACCESS_TOKEN);
          }
          return null;
        }

        if (data.accessToken) {
          setLocalStorageValue(STORAGE_KEYS.DISCORD_ACCESS_TOKEN, data.accessToken);
        }

        return data.signedGuilds as SignedGuild[];
      } catch {
        if (params.accessToken) {
          removeLocalStorageValue(STORAGE_KEYS.DISCORD_ACCESS_TOKEN);
        }
        return null;
      }
    },
    [address, chainId],
  );

  useEffect(() => {
    if (hasRestoredSession.current || !veraxSdk || !address || !chainId || isLoggedIn) {
      return;
    }

    const storedToken = migrateLocalStorageValue(
      LEGACY_DISCORD_TOKEN_KEY,
      STORAGE_KEYS.DISCORD_ACCESS_TOKEN,
    );
    if (!storedToken) {
      return;
    }

    hasRestoredSession.current = true;
    let isCurrent = true;

    const restoreSession = async () => {
      setIsLoading(true);
      try {
        const signedGuilds = await fetchGuildsFromApi({ accessToken: storedToken });
        if (signedGuilds && isCurrent) {
          const enrichedGuilds = await enrichGuildsWithAttestations(signedGuilds, veraxSdk);
          setGuilds(enrichedGuilds);
          setIsLoggedIn(true);
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    };

    void restoreSession();

    return () => {
      isCurrent = false;
    };
  }, [veraxSdk, address, chainId, isLoggedIn, fetchGuildsFromApi, enrichGuildsWithAttestations]);

  useEffect(() => {
    migrateLocalStorageValue(LEGACY_DISCORD_OAUTH_STARTED_KEY, STORAGE_KEYS.DISCORD_OAUTH_STARTED);
  }, []);

  useEffect(() => {
    if (!isLoading || !code || !veraxSdk) {
      return;
    }

    let isCurrent = true;

    const fetchGuilds = async () => {
      removeLocalStorageValue(STORAGE_KEYS.DISCORD_OAUTH_STARTED);
      try {
        const signedGuilds = await fetchGuildsFromApi({ code });
        if (signedGuilds && isCurrent) {
          const enrichedGuilds = await enrichGuildsWithAttestations(signedGuilds, veraxSdk);
          setGuilds(enrichedGuilds);
          setIsLoggedIn(true);
        }
      } finally {
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

  return { isLoggedIn, isLoading, guilds, setGuilds, setIsLoading };
};
