import { useEffect, useState } from 'react';
import { DecodedPayload, SignedGuild } from '../types';
import { Address } from 'viem';
import { VeraxSdk } from '@verax-attestation-registry/verax-sdk';
import { PORTAL_ID, PORTAL_ID_TESTNET, SCHEMA_ID } from '../utils/constants';

export const useFetchGuilds = (
  veraxSdk?: VeraxSdk,
  address?: Address,
  code?: string | null,
  chainId?: number
) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [guilds, setGuilds] = useState<SignedGuild[]>([]);

  useEffect(() => {
    if (isLoading && code && veraxSdk) {
      const fetchGuilds = async () => {
        localStorage.removeItem('discord_oauth_started');
        const baseUrl =
          import.meta.env.VITE_MODE === 'development'
            ? 'http://localhost:8888'
            : 'https://discord.alainnicolas.fr';
        const res = await fetch(
          `${baseUrl}/.netlify/functions/api?code=${code}&isDev=${import.meta.env.VITE_MODE === 'development'}&subject=${address}&chainId=${chainId}`
        );
        const data = await res.json();
        if (!data.error && !data.message) {
          setIsLoggedIn(true);
          const attestedGuilds = await veraxSdk.attestation.findBy(1000, 0, {
            schema: SCHEMA_ID,
            portal: (chainId === 59144 ? PORTAL_ID : PORTAL_ID_TESTNET).toLowerCase(),
            subject: address,
          });
          setGuilds(
            data.signedGuilds.map((guild: SignedGuild) => {
              const attestedGuild = attestedGuilds.find(
                (attested) =>
                  (attested.decodedPayload as DecodedPayload[])[0].guildId === BigInt(guild.id)
              );
              return attestedGuild ? { ...guild, attestationId: attestedGuild.id } : guild;
            })
          );
        }
        setIsLoading(false);
      };
      fetchGuilds();
    }
  }, [isLoading, code, address, veraxSdk, chainId]);

  return { isLoggedIn, isLoading, guilds, setIsLoading };
};
