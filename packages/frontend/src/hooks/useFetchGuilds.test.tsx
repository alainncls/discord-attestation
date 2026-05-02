import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address, Hex } from 'viem';
import { useFetchGuilds } from './useFetchGuilds';
import { STORAGE_KEYS } from '../utils/storage';

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
  });

  it('restores a legacy Discord session and enriches guilds with existing attestations', async () => {
    const { sdk, findBy } = createSdk();
    window.localStorage.setItem('discord_access_token', 'legacy-token');
    mockApiResponse({
      signedGuilds: [{ id: '101', name: 'Linea Builders', signature: '0xsignature' }],
    });

    const { result } = renderHook(() => useFetchGuilds(sdk, address, null, 59144));

    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));

    expect(result.current.guilds).toEqual([
      {
        id: '101',
        name: 'Linea Builders',
        signature: '0xsignature',
        attestationId: '0xattestation',
      },
    ]);
    expect(findBy).toHaveBeenCalledWith(1000, 0, {
      schema: expect.any(String),
      portal: expect.any(String),
      subject: address,
    });
    expect(window.localStorage.getItem('discord_access_token')).toBeNull();

    const calledUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(calledUrl.origin).toBe('https://discord.alainnicolas.fr');
    expect(calledUrl.searchParams.get('accessToken')).toBe('legacy-token');
    expect(calledUrl.searchParams.get('subject')).toBe(address);
    expect(calledUrl.searchParams.get('chainId')).toBe('59144');
  });

  it('clears expired Discord tokens without logging the user in', async () => {
    const { sdk } = createSdk();
    window.localStorage.setItem(STORAGE_KEYS.DISCORD_ACCESS_TOKEN, 'expired-token');
    mockApiResponse({ tokenExpired: true });

    const { result } = renderHook(() => useFetchGuilds(sdk, address, null, 59144));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.guilds).toEqual([]);
    expect(window.localStorage.getItem(STORAGE_KEYS.DISCORD_ACCESS_TOKEN)).toBeNull();
  });

  it('exchanges an OAuth code, stores the returned token, and clears the OAuth marker', async () => {
    const { sdk } = createSdk();
    window.localStorage.setItem(STORAGE_KEYS.DISCORD_OAUTH_STARTED, 'true');
    mockApiResponse({
      accessToken: 'fresh-token',
      signedGuilds: [{ id: '101', name: 'Linea Builders', signature: '0xsignature' }],
    });

    const { result } = renderHook(() => useFetchGuilds(sdk, address, 'oauth-code', 59141));

    act(() => {
      result.current.setIsLoading(true);
    });

    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));

    const calledUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(calledUrl.searchParams.get('code')).toBe('oauth-code');
    expect(calledUrl.searchParams.get('chainId')).toBe('59141');
    expect(window.localStorage.getItem(STORAGE_KEYS.DISCORD_ACCESS_TOKEN)).toBe('fresh-token');
    expect(window.localStorage.getItem(STORAGE_KEYS.DISCORD_OAUTH_STARTED)).toBeNull();
  });
});
