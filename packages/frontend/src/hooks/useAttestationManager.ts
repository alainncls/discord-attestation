import type { Hex } from 'viem';
import { useAccount } from 'wagmi';
import { waitForTransactionReceipt } from 'viem/actions';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { VeraxSdk } from '@verax-attestation-registry/verax-sdk';
import type { SignedGuild } from '../types';
import { PORTAL_ID, PORTAL_ID_TESTNET, SCHEMA_ID } from '../utils/constants';
import { extractAttestationIdFromReceipt } from '../utils/attestationReceipt';
import { wagmiAdapter } from '../wagmiConfig';
import { linea, lineaSepolia } from 'wagmi/chains';
import { discordPortalAbi } from '../utils/discordPortalAbi';

type ShowErrorFn = (message: string) => void;
type ReplacementReason = 'cancelled' | 'replaced' | 'repriced';

const ATTESTATION_FEE = 100000000000000n;

const explorerBaseUrl = (chainId: number | undefined) =>
  chainId === linea.id
    ? 'https://explorer.ver.ax/linea/attestations/'
    : 'https://explorer.ver.ax/linea-sepolia/attestations/';

const receiptClientForChain = (chainId: number | undefined) => {
  if (chainId === linea.id || chainId === lineaSepolia.id) {
    return wagmiAdapter.wagmiConfig.getClient({ chainId });
  }

  return wagmiAdapter.wagmiConfig.getClient();
};

export const useAttestationManager = (
  veraxSdk?: VeraxSdk,
  chainId?: number,
  showError?: ShowErrorFn,
) => {
  const { address, isConnected } = useAccount();
  const [txHash, setTxHash] = useState<Hex>();
  const [attestationId, setAttestationId] = useState<Hex>();
  const [pendingGuildId, setPendingGuildId] = useState<string | null>(null);
  const [transactionChainId, setTransactionChainId] = useState<number>();
  const transactionChainIdRef = useRef<number | undefined>(undefined);
  const inFlightRef = useRef(false);
  const observedAccountRef = useRef({ address, chainId });

  const handleError = useCallback(
    (message: string) => {
      if (showError) {
        showError(message);
      } else {
        console.error(message);
      }
    },
    [showError],
  );

  useEffect(() => {
    const previous = observedAccountRef.current;
    const accountChanged = previous.address !== address || previous.chainId !== chainId;
    observedAccountRef.current = { address, chainId };
    if (!accountChanged) return;

    setTxHash(undefined);
    setAttestationId(undefined);
    if (inFlightRef.current) return;

    transactionChainIdRef.current = undefined;
    setTransactionChainId(undefined);
  }, [address, chainId]);

  const issueAttestation = useCallback(
    async (
      signedGuild: SignedGuild,
      onSuccess?: (guildId: string, attestId: Hex) => void,
      onError?: () => void,
    ) => {
      if (!address || !veraxSdk) return;
      if (inFlightRef.current) return;

      const submission = {
        address,
        chainId,
        portalId: chainId === linea.id ? PORTAL_ID : PORTAL_ID_TESTNET,
        client: receiptClientForChain(chainId),
      };
      inFlightRef.current = true;
      transactionChainIdRef.current = submission.chainId;
      setTransactionChainId(submission.chainId);
      setTxHash(undefined);
      setAttestationId(undefined);
      setPendingGuildId(signedGuild.id);

      try {
        const submitted = await veraxSdk.portal.attest(
          submission.portalId,
          {
            schemaId: SCHEMA_ID,
            expirationDate: signedGuild.expirationDate,
            subject: submission.address,
            attestationData: [{ guildId: signedGuild.id, guildName: signedGuild.name }],
          },
          [signedGuild.signature],
          {
            waitForConfirmation: false,
            value: ATTESTATION_FEE,
            customAbi: discordPortalAbi,
          },
        );

        if (!submitted.transactionHash) {
          onError?.();
          handleError('Transaction failed. Please try again.');
          return;
        }

        setTxHash(submitted.transactionHash);
        let replacementReason: ReplacementReason | undefined;
        const receipt = await waitForTransactionReceipt(submission.client, {
          hash: submitted.transactionHash,
          onReplaced: (replacement) => {
            replacementReason = replacement.reason;
          },
        });

        if (replacementReason === 'cancelled' || replacementReason === 'replaced') {
          onError?.();
          handleError(
            replacementReason === 'cancelled'
              ? 'Transaction was cancelled. Please try again.'
              : 'Transaction was replaced. Please try again.',
          );
          return;
        }

        if (receipt.status !== 'success') {
          onError?.();
          handleError('Transaction reverted. Please try again.');
          return;
        }

        const attestId = extractAttestationIdFromReceipt(submission.chainId, receipt.logs);
        if (!attestId) {
          onError?.();
          handleError('Attestation event was not found. Please try again.');
          return;
        }

        transactionChainIdRef.current = submission.chainId;
        setTransactionChainId(submission.chainId);
        setTxHash(submitted.transactionHash);
        setAttestationId(attestId);
        onSuccess?.(signedGuild.id, attestId);
      } catch (e) {
        onError?.();
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
        const replaced = e instanceof Error && e.name === 'TransactionReceiptReplacedError';
        handleError(
          replaced
            ? 'Transaction was replaced. Please try again.'
            : `Attestation failed: ${errorMessage}`,
        );
      } finally {
        inFlightRef.current = false;
        setPendingGuildId(null);
      }
    },
    [address, chainId, veraxSdk, handleError],
  );

  const handleAttest = useCallback(
    async (
      signedGuild: SignedGuild,
      onSuccess?: (guildId: string, attestId: Hex) => void,
      onError?: () => void,
    ) => {
      if (isConnected) {
        await issueAttestation(signedGuild, onSuccess, onError);
      }
    },
    [isConnected, issueAttestation],
  );

  const handleCheck = useCallback(
    (signedGuild: SignedGuild) => {
      if (signedGuild.attestationId) {
        const linkChainId = transactionChainIdRef.current ?? chainId;
        window.open(
          `${explorerBaseUrl(linkChainId)}${signedGuild.attestationId}`,
          '_blank',
          'noopener,noreferrer',
        );
      }
    },
    [chainId],
  );

  return {
    txHash,
    attestationId,
    pendingGuildId,
    transactionChainId,
    handleAttest,
    handleCheck,
  };
};
