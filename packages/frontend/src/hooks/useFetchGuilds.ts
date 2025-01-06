import { useEffect, useState } from 'react';
import { DecodedPayload, SignedGuild } from '../types';
import { Address } from 'viem';
import { VeraxSdk } from '@verax-attestation-registry/verax-sdk';
import { PORTAL_ID, SCHEMA_ID } from '../utils/constants';

export const useFetchGuilds = (
  veraxSdk?: VeraxSdk,
  address?: Address,
  code?: string | null,
) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [guilds, setGuilds] = useState<SignedGuild[]>([]);

  useEffect(() => {
    if (isLoading && code && veraxSdk) {
      const fetchGuilds = async () => {
        localStorage.removeItem('discord_oauth_started');
        const res = await fetch(
          `https://discord.alainnicolas.fr/.netlify/functions/api?code=${code}&isDev=${import.meta.env.MODE === 'development'}&subject=${address}`,
        );
        const data = await res.json();
        if (!data.error && !data.message) {
          setIsLoggedIn(true);
          const attestedGuilds = await veraxSdk.attestation.findBy(1000, 0, {
            schema: SCHEMA_ID,
            portal: PORTAL_ID.toLowerCase(),
            subject: address,
          });
          setGuilds(
            data.signedGuilds.map((guild: SignedGuild) => {
              const attestedGuild = attestedGuilds.find(
                (attested) =>
                  (attested.decodedPayload as DecodedPayload[])[0].guildId ===
                  BigInt(guild.id),
              );
              return attestedGuild
                ? { ...guild, attestationId: attestedGuild.id }
                : guild;
            }),
          );
        }
        setIsLoading(false);
      };
      fetchGuilds();
    }
  }, [isLoading, code, address, veraxSdk]);

  return { isLoggedIn, isLoading, guilds, setIsLoading };
};
