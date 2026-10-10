import { useCallback, useEffect, useRef, useState } from 'react';
import type { DecodedPayload, SignedGuild } from '../types';
import type { Address, Hex } from 'viem';
import type { VeraxSdk } from '@verax-attestation-registry/verax-sdk';
import { PORTAL_ID, PORTAL_ID_TESTNET, SCHEMA_ID } from '../utils/constants';
import { linea } from 'wagmi/chains';
import { removeLocalStorageValue, STORAGE_KEYS } from '../utils/storage';

const LEGACY_DISCORD_TOKEN_KEY = 'discord_access_token';

interface OAuthExchangeEntry {
  identityKey: string;
  controller: AbortController;
  promise: Promise<SignedGuild[] | null>;
  references: number;
  pending: boolean;
}

// Keep a callback single-flight across StrictMode's setup/cleanup/setup cycle.
// State is one-use server-side, so an aborted client request must never be retried.
const oauthExchanges = new Map<string, OAuthExchangeEntry>();

const acquireOAuthExchange = (
  state: string,
  identityKey: string,
  execute: (signal: AbortSignal) => Promise<SignedGuild[] | null>,
): { promise: Promise<SignedGuild[] | null>; release: () => void } | null => {
  const existing = oauthExchanges.get(state);
  if (existing) {
    if (existing.identityKey !== identityKey) return null;
    existing.references += 1;
    return createOAuthExchangeLease(existing);
  }

  while (oauthExchanges.size >= 64) {
    const completed = [...oauthExchanges.entries()].find(([, entry]) => !entry.pending);
    if (!completed) return null;
    oauthExchanges.delete(completed[0]);
  }

  const controller = new AbortController();
  const entry: OAuthExchangeEntry = {
    identityKey,
    controller,
    promise: Promise.resolve(null),
    references: 1,
    pending: true,
  };
  entry.promise = execute(controller.signal).finally(() => {
    entry.pending = false;
  });
  oauthExchanges.set(state, entry);

  return createOAuthExchangeLease(entry);
};

const releaseOAuthExchange = (entry: OAuthExchangeEntry): void => {
  entry.references = Math.max(0, entry.references - 1);
  if (!entry.references && entry.pending) {
    queueMicrotask(() => {
      if (!entry.references && entry.pending) entry.controller.abort();
    });
  }
};

const createOAuthExchangeLease = (
  entry: OAuthExchangeEntry,
): { promise: Promise<SignedGuild[] | null>; release: () => void } => {
  let released = false;
  return {
    promise: entry.promise,
    release: () => {
      if (released) return;
      released = true;
      releaseOAuthExchange(entry);
    },
  };
};

const getIdentityKey = (address?: Address, chainId?: number): string =>
  `${address?.toLowerCase() ?? 'disconnected'}:${chainId ?? 'unknown'}`;

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
  const identityKey = getIdentityKey(address, chainId);
  const currentIdentityRef = useRef(identityKey);
  const requestEpochRef = useRef(0);
  const [sessionIdentity, setSessionIdentity] = useState(identityKey);
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
        if (signal.aborted) return null;
        const data = await res.json();
        if (signal.aborted || !res.ok) return null;

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
    currentIdentityRef.current = identityKey;
    const identityEpoch = (requestEpochRef.current += 1);
    queueMicrotask(() => {
      if (requestEpochRef.current !== identityEpoch) return;
      setSessionIdentity(identityKey);
      setIsLoggedIn(false);
      setGuilds([]);
    });
  }, [identityKey]);

  useEffect(() => {
    if (!isLoading || !code || !veraxSdk) {
      return;
    }

    let isCurrent = true;
    const requestEpoch = requestEpochRef.current;
    const requestIdentity = identityKey;
    let releaseExchange: (() => void) | undefined;
    const isRequestCurrent = () =>
      isCurrent &&
      requestEpochRef.current === requestEpoch &&
      currentIdentityRef.current === requestIdentity;

    const fetchGuilds = async () => {
      if (!state || !address || !chainId) {
        clearOAuthCodeFromUrl(code, state ?? null);
        setIsLoading(false);
        return;
      }

      try {
        const exchange = acquireOAuthExchange(state, requestIdentity, (signal) =>
          fetchGuildsFromApi({ code, state }, signal),
        );
        if (!exchange) return;
        releaseExchange = exchange.release;
        const signedGuilds = await exchange.promise;
        if (!signedGuilds || !isRequestCurrent()) return;

        {
          const enrichedGuilds = await enrichGuildsWithAttestations(signedGuilds, veraxSdk);
          if (!isRequestCurrent()) return;
          setSessionIdentity(requestIdentity);
          setGuilds(enrichedGuilds);
          setIsLoggedIn(true);
        }
      } finally {
        releaseExchange?.();
        if (isRequestCurrent()) {
          clearOAuthCodeFromUrl(code, state);
          setIsLoading(false);
        }
      }
    };

    void fetchGuilds();

    return () => {
      isCurrent = false;
      releaseExchange?.();
    };
  }, [
    isLoading,
    code,
    state,
    identityKey,
    address,
    chainId,
    veraxSdk,
    fetchGuildsFromApi,
    enrichGuildsWithAttestations,
  ]);

  const isSessionCurrent = sessionIdentity === identityKey;
  return {
    isLoggedIn: isSessionCurrent && isLoggedIn,
    isLoading,
    guilds: isSessionCurrent ? guilds : [],
    setGuilds,
  };
};
