import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address, Hex } from 'viem';
import { waitForTransactionReceipt } from 'viem/actions';
import { useAttestationManager } from './useAttestationManager';
import type { SignedGuild } from '../types';

const mocks = vi.hoisted(() => ({
  account: {
    address: '0x0000000000000000000000000000000000000001' as Address,
    isConnected: true,
  },
  getClient: vi.fn(() => ({ id: 'client' })),
  waitForTransactionReceipt: vi.fn(),
}));

vi.mock('wagmi', () => ({
  useAccount: () => mocks.account,
}));

vi.mock('wagmi/chains', () => ({
  linea: { id: 59144 },
}));

vi.mock('viem/actions', () => ({
  waitForTransactionReceipt: mocks.waitForTransactionReceipt,
}));

vi.mock('../wagmiConfig', () => ({
  wagmiAdapter: {
    wagmiConfig: {
      getClient: mocks.getClient,
    },
  },
}));

const guild: SignedGuild = {
  id: '101',
  name: 'Linea Builders',
  signature: '0xsignature',
};

describe('useAttestationManager', () => {
  beforeEach(() => {
    mocks.account.address = '0x0000000000000000000000000000000000000001' as Address;
    mocks.account.isConnected = true;
    mocks.getClient.mockClear();
    mocks.waitForTransactionReceipt.mockReset();
  });

  it('submits an attestation, waits for confirmation, and exposes the attestation id', async () => {
    const transactionHash = '0xtransaction' as Hex;
    const attestationId = '0xattestation' as Hex;
    const attest = vi.fn().mockResolvedValue({ transactionHash });
    mocks.waitForTransactionReceipt.mockResolvedValue({
      logs: [{ topics: ['0xtopic', attestationId] }],
    } as unknown as Awaited<ReturnType<typeof waitForTransactionReceipt>>);

    const veraxSdk = {
      portal: { attest },
    } as unknown as NonNullable<Parameters<typeof useAttestationManager>[0]>;
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const showError = vi.fn();

    const { result } = renderHook(() => useAttestationManager(veraxSdk, 59144, showError));

    await act(async () => {
      await result.current.handleAttest(guild, onSuccess, onError);
    });

    expect(attest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        schemaId: expect.any(String),
        subject: mocks.account.address,
        attestationData: [{ guildId: guild.id, guildName: guild.name }],
      }),
      [guild.signature],
      expect.objectContaining({
        waitForConfirmation: false,
        value: 100000000000000n,
      }),
    );
    expect(mocks.getClient).toHaveBeenCalled();
    expect(mocks.waitForTransactionReceipt).toHaveBeenCalledWith(
      { id: 'client' },
      { hash: transactionHash },
    );
    expect(onSuccess).toHaveBeenCalledWith(guild.id, attestationId);
    expect(onError).not.toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();

    await waitFor(() => expect(result.current.txHash).toBe(transactionHash));
    expect(result.current.attestationId).toBe(attestationId);
    expect(result.current.pendingGuildId).toBeNull();
  });

  it('does not submit when the wallet is disconnected', async () => {
    mocks.account.isConnected = false;
    const attest = vi.fn();
    const veraxSdk = {
      portal: { attest },
    } as unknown as NonNullable<Parameters<typeof useAttestationManager>[0]>;

    const { result } = renderHook(() => useAttestationManager(veraxSdk, 59144, vi.fn()));

    await act(async () => {
      await result.current.handleAttest(guild);
    });

    expect(attest).not.toHaveBeenCalled();
  });
});
