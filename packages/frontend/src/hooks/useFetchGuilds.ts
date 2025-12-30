import { useEffect, useState, useCallback } from 'react';
import type { DecodedPayload, SignedGuild } from '../types';
import type { Address, Hex } from 'viem';
import { VeraxSdk } from '@verax-attestation-registry/verax-sdk';
import { PORTAL_ID, PORTAL_ID_TESTNET, SCHEMA_ID } from '../utils/constants';
import { linea } from 'wagmi/chains';

const DISCORD_TOKEN_KEY = 'discord_access_token';

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

  const enrichGuildsWithAttestations = useCallback(
    async (signedGuilds: SignedGuild[], sdk: VeraxSdk): Promise<SignedGuild[]> => {
      const portalId = chainId === linea.id ? PORTAL_ID : PORTAL_ID_TESTNET;
      const attestedGuilds = await sdk.attestation.findBy(1000, 0, {
        schema: SCHEMA_ID,
        portal: portalId.toLowerCase(),
        subject: address,
      });
      return signedGuilds.map((guild: SignedGuild): SignedGuild => {
        const attestedGuild = attestedGuilds.find(
          (attested) =>
            (attested.decodedPayload as DecodedPayload[])[0]?.guildId === BigInt(guild.id),
        );
        return attestedGuild ? { ...guild, attestationId: attestedGuild.id as Hex } : guild;
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

      const res = await fetch(`${baseUrl}/.netlify/functions/api?${searchParams}`);
      const data = await res.json();

      if (data.tokenExpired) {
        localStorage.removeItem(DISCORD_TOKEN_KEY);
        return null;
      }

      if (data.error || data.message) {
        return null;
      }

      // Store the access token for future sessions
      if (data.accessToken) {
        localStorage.setItem(DISCORD_TOKEN_KEY, data.accessToken);
      }

      return data.signedGuilds as SignedGuild[];
    },
    [address, chainId],
  );

  // Try to restore session from stored token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(DISCORD_TOKEN_KEY);
    if (storedToken && veraxSdk && address && chainId && !isLoggedIn && !isLoading) {
      const restoreSession = async () => {
        setIsLoading(true);
        const signedGuilds = await fetchGuildsFromApi({ accessToken: storedToken });
        if (signedGuilds) {
          const enrichedGuilds = await enrichGuildsWithAttestations(signedGuilds, veraxSdk);
          setGuilds(enrichedGuilds);
          setIsLoggedIn(true);
        }
        setIsLoading(false);
      };
      restoreSession();
    }
  }, [
    veraxSdk,
    address,
    chainId,
    isLoggedIn,
    isLoading,
    fetchGuildsFromApi,
    enrichGuildsWithAttestations,
  ]);

  // Handle OAuth callback with code
  useEffect(() => {
    if (isLoading && code && veraxSdk) {
      const fetchGuilds = async () => {
        localStorage.removeItem('discord_oauth_started');
        const signedGuilds = await fetchGuildsFromApi({ code });
        if (signedGuilds) {
          const enrichedGuilds = await enrichGuildsWithAttestations(signedGuilds, veraxSdk);
          setGuilds(enrichedGuilds);
          setIsLoggedIn(true);
        }
        setIsLoading(false);
      };
      fetchGuilds();
    }
  }, [isLoading, code, veraxSdk, fetchGuildsFromApi, enrichGuildsWithAttestations]);

  return { isLoggedIn, isLoading, guilds, setGuilds, setIsLoading };
};
