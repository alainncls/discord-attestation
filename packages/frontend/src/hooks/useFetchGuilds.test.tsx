import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address, Hex } from 'viem';
import { useFetchGuilds } from './useFetchGuilds';
import { removeLocalStorageValue, setLocalStorageValue, STORAGE_KEYS } from '../utils/storage';

vi.mock('@verax-attestation-registry/verax-sdk', () => ({
  VeraxSdk: class VeraxSdk {},
}));

const address = '0x0000000000000000000000000000000000000001' as Address;
const fetchMock = vi.fn<typeof fetch>();

const createSdk = () => {
  const findBy = vi.fn().mockResolvedValue([
    {
      id: '0xattestation' as Hex,
      decodedPayload: [{ guildId: 101n }],
    },
  ]);

  return {
    sdk: {
      attestation: { findBy },
    } as unknown as NonNullable<Parameters<typeof useFetchGuilds>[0]>,
    findBy,
  };
};

const mockApiResponse = (body: unknown) => {
  fetchMock.mockResolvedValue({
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response);
};

describe('useFetchGuilds', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/');
    window.localStorage.clear();
    removeLocalStorageValue(STORAGE_KEYS.DISCORD_ACCESS_TOKEN);
  });

  it('clears stored Discord tokens without restoring a session', async () => {
    const { sdk } = createSdk();
    window.localStorage.setItem('discord_access_token', 'legacy-token');
    setLocalStorageValue(STORAGE_KEYS.DISCORD_ACCESS_TOKEN, 'stored-token');

    const { result } = renderHook(() => useFetchGuilds(sdk, address, null, 59144));

    await waitFor(() =>
      expect(window.localStorage.getItem(STORAGE_KEYS.DISCORD_ACCESS_TOKEN)).toBeNull(),
    );

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.guilds).toEqual([]);
    expect(window.localStorage.getItem('discord_access_token')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exchanges the server-issued callback state and clears the URL without storing a token', async () => {
    const { sdk, findBy } = createSdk();
    window.history.pushState({}, '', '/?code=oauth-code&state=oauth-state');
    mockApiResponse({
      signedGuilds: [
        {
          id: '101',
          name: 'Linea Builders',
          signature: '0xsignature',
          expirationDate: 1_769_459_200,
        },
      ],
    });

    const { result } = renderHook(() =>
      useFetchGuilds(sdk, address, 'oauth-code', 59141, 'oauth-state'),
    );

    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));

    expect(result.current.guilds).toEqual([
      {
        id: '101',
        name: 'Linea Builders',
        signature: '0xsignature',
        expirationDate: 1_769_459_200,
        attestationId: '0xattestation',
      },
    ]);
    expect(findBy).toHaveBeenCalledWith(1000, 0, {
      schema: expect.any(String),
      portal: expect.any(String),
      subject: address,
    });
    expect(fetchMock).toHaveBeenCalledWith('/.netlify/functions/api', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'exchange',
        subject: address,
        chainId: '59141',
        code: 'oauth-code',
        state: 'oauth-state',
      }),
      signal: expect.any(AbortSignal),
    });
    expect(window.localStorage.getItem(STORAGE_KEYS.DISCORD_ACCESS_TOKEN)).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('sends the callback state to the server and clears a rejected callback URL', async () => {
    const { sdk } = createSdk();
    window.history.pushState({}, '', '/?code=oauth-code&state=attacker-state');
    mockApiResponse({ error: 'Invalid or expired OAuth state' });

    const { result } = renderHook(() =>
      useFetchGuilds(sdk, address, 'oauth-code', 59141, 'attacker-state'),
    );

    await waitFor(() => expect(window.location.search).toBe(''));

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.guilds).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      action: 'exchange',
      state: 'attacker-state',
    });
  });

  it('clears a callback without state without sending the code to the API', async () => {
    const { sdk } = createSdk();
    window.history.pushState({}, '', '/?code=oauth-code');

    const { result } = renderHook(() => useFetchGuilds(sdk, address, 'oauth-code', 59141, null));

    await waitFor(() => expect(window.location.search).toBe(''));
    expect(result.current.isLoading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
