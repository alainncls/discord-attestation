import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address, Hex } from 'viem';
import { useAttestationManager } from './useAttestationManager';
import type { SignedGuild } from '../types';
import { discordPortalAbi } from '../utils/discordPortalAbi';
import {
  ATTESTATION_REGISTERED_EVENT_TOPIC,
  LINEA_MAINNET_ATTESTATION_REGISTRY,
  LINEA_SEPOLIA_ATTESTATION_REGISTRY,
  PORTAL_ID,
  PORTAL_ID_TESTNET,
  SCHEMA_ID,
} from '../utils/constants';

const ORIGINAL_ADDRESS = '0x0000000000000000000000000000000000000001' as Address;
const OTHER_ADDRESS = '0x0000000000000000000000000000000000000002' as Address;
const LINEA_MAINNET = 59144;
const LINEA_SEPOLIA = 59141;
const WRONG_REGISTRY = '0x1111111111111111111111111111111111111111' as Address;
const WRONG_TOPIC = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as Hex;
const ATTESTATION_ID = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex;
const DECOY_ID = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Hex;
const TX_HASH = '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' as Hex;

const mocks = vi.hoisted(() => ({
  account: {
    address: '0x0000000000000000000000000000000000000001' as Address,
    isConnected: true,
  },
  getClient: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
}));

vi.mock('wagmi', () => ({
  useAccount: () => mocks.account,
}));

vi.mock('wagmi/chains', () => ({
  linea: { id: 59144 },
  lineaSepolia: { id: 59141 },
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
  expirationDate: 1_769_459_200,
};

const registeredLog = (
  address: Address,
  attestationId: Hex,
  topic = ATTESTATION_REGISTERED_EVENT_TOPIC,
) => ({
  address,
  topics: [topic, attestationId] as const,
});

const successReceipt = (
  logs: Array<{ address?: Address; topics?: readonly Hex[] }>,
  status: 'success' | 'reverted' = 'success',
) => ({ status, logs });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useAttestationManager', () => {
  beforeEach(() => {
    mocks.account.address = ORIGINAL_ADDRESS;
    mocks.account.isConnected = true;
    mocks.getClient.mockReset();
    mocks.getClient.mockImplementation(() => ({ id: 'client' }));
    mocks.waitForTransactionReceipt.mockReset();
    vi.stubGlobal(
      'open',
      vi.fn(() => null),
    );
  });

  const renderManager = (chainId = LINEA_MAINNET) => {
    const attest = vi.fn();
    const veraxSdk = {
      portal: { attest },
    } as unknown as NonNullable<Parameters<typeof useAttestationManager>[0]>;
    const showError = vi.fn();
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const hook = renderHook(
      ({ nextChainId }: { nextChainId: number }) =>
        useAttestationManager(veraxSdk, nextChainId, showError),
      { initialProps: { nextChainId: chainId } },
    );

    return { ...hook, attest, showError, onSuccess, onError, veraxSdk };
  };

  const expectPayload = (attest: ReturnType<typeof vi.fn>, portalId: Address, subject: Address) => {
    expect(attest).toHaveBeenCalledWith(
      portalId,
      {
        schemaId: SCHEMA_ID,
        expirationDate: guild.expirationDate,
        subject,
        attestationData: [{ guildId: guild.id, guildName: guild.name }],
      },
      [guild.signature],
      {
        waitForConfirmation: false,
        value: 100000000000000n,
        customAbi: discordPortalAbi,
      },
    );
  };

  it('accepts the registry event even when adversarial logs come first', async () => {
    const submissionClient = { id: 'submission-client' };
    mocks.getClient.mockReturnValue(submissionClient);
    const { result, attest, onSuccess, onError, showError } = renderManager();
    attest.mockResolvedValue({ transactionHash: TX_HASH });
    mocks.waitForTransactionReceipt.mockResolvedValue(
      successReceipt([
        registeredLog(WRONG_REGISTRY, DECOY_ID),
        registeredLog(LINEA_MAINNET_ATTESTATION_REGISTRY, DECOY_ID, WRONG_TOPIC),
        {
          address: LINEA_MAINNET_ATTESTATION_REGISTRY.toLowerCase() as Address,
          topics: [ATTESTATION_REGISTERED_EVENT_TOPIC.toUpperCase() as Hex, ATTESTATION_ID],
        },
        registeredLog(LINEA_MAINNET_ATTESTATION_REGISTRY, DECOY_ID),
      ]),
    );

    await act(async () => {
      await result.current.handleAttest(guild, onSuccess, onError);
    });

    expectPayload(attest, PORTAL_ID, ORIGINAL_ADDRESS);
    expect(mocks.getClient).toHaveBeenCalledWith({ chainId: LINEA_MAINNET });
    expect(mocks.waitForTransactionReceipt).toHaveBeenCalledWith(submissionClient, {
      hash: TX_HASH,
      onReplaced: expect.any(Function),
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(guild.id, ATTESTATION_ID);
    expect(onError).not.toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
    expect(result.current.attestationId).toBe(ATTESTATION_ID);
    expect(result.current.txHash).toBe(TX_HASH);
    expect(result.current.pendingGuildId).toBeNull();
    expect(result.current.transactionChainId).toBe(LINEA_MAINNET);
  });

  it.each([
    ['wrong registry', [registeredLog(WRONG_REGISTRY, DECOY_ID)]],
    ['wrong topic', [registeredLog(LINEA_MAINNET_ATTESTATION_REGISTRY, DECOY_ID, WRONG_TOPIC)]],
    ['empty logs', []],
    ['missing logs', undefined],
  ])('rejects a receipt with %s', async (_label, logs) => {
    const { result, attest, onSuccess, onError, showError } = renderManager();
    attest.mockResolvedValue({ transactionHash: TX_HASH });
    mocks.waitForTransactionReceipt.mockResolvedValue({
      status: 'success',
      logs,
    });

    await act(async () => {
      await result.current.handleAttest(guild, onSuccess, onError);
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(showError).toHaveBeenCalledWith('Attestation event was not found. Please try again.');
    expect(result.current.attestationId).toBeUndefined();
    expect(result.current.pendingGuildId).toBeNull();
  });

  it('rejects a reverted receipt even when the expected event is present', async () => {
    const { result, attest, onSuccess, onError, showError } = renderManager();
    attest.mockResolvedValue({ transactionHash: TX_HASH });
    mocks.waitForTransactionReceipt.mockResolvedValue(
      successReceipt(
        [registeredLog(LINEA_MAINNET_ATTESTATION_REGISTRY, ATTESTATION_ID)],
        'reverted',
      ),
    );

    await act(async () => {
      await result.current.handleAttest(guild, onSuccess, onError);
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(showError).toHaveBeenCalledWith('Transaction reverted. Please try again.');
    expect(result.current.pendingGuildId).toBeNull();
  });

  it('reports wallet rejection without waiting for a receipt', async () => {
    const { result, attest, onSuccess, onError, showError } = renderManager();
    attest.mockRejectedValue(new Error('User rejected the request'));

    await act(async () => {
      await result.current.handleAttest(guild, onSuccess, onError);
    });

    expect(mocks.waitForTransactionReceipt).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(showError).toHaveBeenCalledWith('Attestation failed: User rejected the request');
    expect(result.current.pendingGuildId).toBeNull();
  });

  it('settles pending when the receipt wait is replaced or throws', async () => {
    const { result, attest, onSuccess, onError, showError } = renderManager();
    attest.mockResolvedValue({ transactionHash: TX_HASH });
    const replacement = new Error('transaction replaced');
    replacement.name = 'TransactionReceiptReplacedError';
    mocks.waitForTransactionReceipt.mockRejectedValue(replacement);

    await act(async () => {
      await result.current.handleAttest(guild, onSuccess, onError);
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(showError).toHaveBeenCalledWith('Transaction was replaced. Please try again.');
    expect(result.current.pendingGuildId).toBeNull();
  });

  it('does not accept a cancelled or data-replaced transaction as this guild attestation', async () => {
    const { result, attest, onSuccess, onError, showError } = renderManager();
    attest.mockResolvedValue({ transactionHash: TX_HASH });
    mocks.waitForTransactionReceipt.mockImplementation(
      async (
        _client: unknown,
        parameters: { onReplaced?: (replacement: { reason: string }) => void },
      ) => {
        parameters.onReplaced?.({ reason: 'replaced' });
        return successReceipt([registeredLog(LINEA_MAINNET_ATTESTATION_REGISTRY, DECOY_ID)]);
      },
    );

    await act(async () => {
      await result.current.handleAttest(guild, onSuccess, onError);
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(showError).toHaveBeenCalledWith('Transaction was replaced. Please try again.');
    expect(result.current.attestationId).toBeUndefined();
    expect(result.current.pendingGuildId).toBeNull();
  });

  it('keeps the originating success and explorer chain when the wallet changes during the wait', async () => {
    const submissionClient = { id: 'submission-client' };
    const laterClient = { id: 'later-client' };
    let phase: 'submission' | 'later' = 'submission';
    mocks.getClient.mockImplementation(() =>
      phase === 'submission' ? submissionClient : laterClient,
    );
    const receiptGate = deferred<ReturnType<typeof successReceipt>>();
    mocks.waitForTransactionReceipt.mockImplementation(() => receiptGate.promise);

    const { result, rerender, attest, onSuccess, onError } = renderManager();
    attest.mockImplementation(async () => {
      phase = 'later';
      return { transactionHash: TX_HASH };
    });

    let pending: Promise<unknown> = Promise.resolve();
    await act(async () => {
      pending = result.current.handleAttest(guild, onSuccess, onError);
    });

    expect(attest).toHaveBeenCalledTimes(1);
    expectPayload(attest, PORTAL_ID, ORIGINAL_ADDRESS);
    expect(mocks.waitForTransactionReceipt).toHaveBeenCalledWith(submissionClient, {
      hash: TX_HASH,
      onReplaced: expect.any(Function),
    });
    expect(result.current.pendingGuildId).toBe(guild.id);

    mocks.account.address = OTHER_ADDRESS;
    rerender({ nextChainId: LINEA_SEPOLIA });

    await waitFor(() => expect(result.current.txHash).toBeUndefined());
    expect(result.current.attestationId).toBeUndefined();
    expect(attest).toHaveBeenCalledTimes(1);

    await act(async () => {
      receiptGate.resolve(
        successReceipt([registeredLog(LINEA_MAINNET_ATTESTATION_REGISTRY, ATTESTATION_ID)]),
      );
      await pending;
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(guild.id, ATTESTATION_ID);
    expect(onError).not.toHaveBeenCalled();
    expect(attest).toHaveBeenCalledTimes(1);
    expect(result.current.attestationId).toBe(ATTESTATION_ID);
    expect(result.current.txHash).toBe(TX_HASH);
    expect(result.current.transactionChainId).toBe(LINEA_MAINNET);
    expect(result.current.pendingGuildId).toBeNull();

    act(() => {
      result.current.handleCheck({ ...guild, attestationId: ATTESTATION_ID });
    });
    expect(window.open).toHaveBeenCalledWith(
      `https://explorer.ver.ax/linea/attestations/${ATTESTATION_ID}`,
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('allows only one in-flight portal.attest call', async () => {
    const receiptGate = deferred<ReturnType<typeof successReceipt>>();
    mocks.waitForTransactionReceipt.mockImplementation(() => receiptGate.promise);
    const { result, attest, onSuccess, onError } = renderManager();
    attest.mockResolvedValue({ transactionHash: TX_HASH });

    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    await act(async () => {
      first = result.current.handleAttest(guild, onSuccess, onError);
      second = result.current.handleAttest(guild, onSuccess, onError);
    });

    expect(attest).toHaveBeenCalledTimes(1);
    expect(result.current.pendingGuildId).toBe(guild.id);

    await act(async () => {
      receiptGate.resolve(
        successReceipt([registeredLog(LINEA_MAINNET_ATTESTATION_REGISTRY, ATTESTATION_ID)]),
      );
      await first;
      await second;
    });

    expect(attest).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(guild.id, ATTESTATION_ID);
    expect(result.current.pendingGuildId).toBeNull();
  });

  it('clears settled success state when the wallet or network changes', async () => {
    const { result, rerender, attest, onSuccess } = renderManager();
    attest.mockResolvedValue({ transactionHash: TX_HASH });
    mocks.waitForTransactionReceipt.mockResolvedValue(
      successReceipt([registeredLog(LINEA_MAINNET_ATTESTATION_REGISTRY, ATTESTATION_ID)]),
    );

    await act(async () => {
      await result.current.handleAttest(guild, onSuccess, vi.fn());
    });
    expect(result.current.attestationId).toBe(ATTESTATION_ID);

    mocks.account.address = OTHER_ADDRESS;
    rerender({ nextChainId: LINEA_SEPOLIA });

    await waitFor(() => expect(result.current.attestationId).toBeUndefined());
    expect(result.current.txHash).toBeUndefined();
    expect(result.current.transactionChainId).toBeUndefined();
    expect(attest).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.handleCheck({ ...guild, attestationId: ATTESTATION_ID });
    });
    expect(window.open).toHaveBeenCalledWith(
      `https://explorer.ver.ax/linea-sepolia/attestations/${ATTESTATION_ID}`,
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('uses the captured Sepolia portal, registry, and explorer chain', async () => {
    const sepoliaClient = { id: 'sepolia-client' };
    mocks.getClient.mockReturnValue(sepoliaClient);
    const { result, attest, onSuccess } = renderManager(LINEA_SEPOLIA);
    attest.mockResolvedValue({ transactionHash: TX_HASH });
    mocks.waitForTransactionReceipt.mockResolvedValue(
      successReceipt([
        registeredLog(LINEA_MAINNET_ATTESTATION_REGISTRY, DECOY_ID),
        registeredLog(LINEA_SEPOLIA_ATTESTATION_REGISTRY, ATTESTATION_ID),
      ]),
    );

    await act(async () => {
      await result.current.handleAttest(guild, onSuccess, vi.fn());
    });

    expectPayload(attest, PORTAL_ID_TESTNET, ORIGINAL_ADDRESS);
    expect(mocks.getClient).toHaveBeenCalledWith({ chainId: LINEA_SEPOLIA });
    expect(mocks.waitForTransactionReceipt).toHaveBeenCalledWith(
      sepoliaClient,
      expect.objectContaining({ hash: TX_HASH }),
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(guild.id, ATTESTATION_ID);
    expect(result.current.transactionChainId).toBe(LINEA_SEPOLIA);

    act(() => {
      result.current.handleCheck({ ...guild, attestationId: ATTESTATION_ID });
    });
    expect(window.open).toHaveBeenCalledWith(
      `https://explorer.ver.ax/linea-sepolia/attestations/${ATTESTATION_ID}`,
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('does not submit when the wallet is disconnected', async () => {
    mocks.account.isConnected = false;
    const { result, attest } = renderManager();

    await act(async () => {
      await result.current.handleAttest(guild);
    });

    expect(attest).not.toHaveBeenCalled();
    expect(result.current.pendingGuildId).toBeNull();
  });
});
