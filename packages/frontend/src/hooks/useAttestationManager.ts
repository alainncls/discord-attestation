import type { Hex } from 'viem';
import { useAccount } from 'wagmi';
import { waitForTransactionReceipt } from 'viem/actions';
import { add } from 'date-fns';
import { useCallback, useState } from 'react';
import { VeraxSdk } from '@verax-attestation-registry/verax-sdk';
import type { SignedGuild } from '../types';
import { PORTAL_ID, PORTAL_ID_TESTNET, SCHEMA_ID } from '../utils/constants';
import { wagmiAdapter } from '../wagmiConfig';
import { linea } from 'wagmi/chains';
import { discordPortalAbi } from '../utils/discordPortalAbi';

type ShowErrorFn = (message: string) => void;

export const useAttestationManager = (
  veraxSdk?: VeraxSdk,
  chainId?: number,
  showError?: ShowErrorFn,
) => {
  const { address, isConnected } = useAccount();
  const [txHash, setTxHash] = useState<Hex>();
  const [attestationId, setAttestationId] = useState<Hex>();
  const [pendingGuildId, setPendingGuildId] = useState<string | null>(null);

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

  const issueAttestation = useCallback(
    async (
      signedGuild: SignedGuild,
      onSuccess?: (guildId: string, attestId: Hex) => void,
      onError?: () => void,
    ) => {
      if (!address || !veraxSdk) return;

      try {
        setTxHash(undefined);
        setAttestationId(undefined);
        setPendingGuildId(signedGuild.id);

        let receipt = await veraxSdk.portal.attest(
          chainId === linea.id ? PORTAL_ID : PORTAL_ID_TESTNET,
          {
            schemaId: SCHEMA_ID,
            expirationDate: Math.floor(add(new Date(), { months: 1 }).getTime() / 1000),
            subject: address,
            attestationData: [{ guildId: signedGuild.id, guildName: signedGuild.name }],
          },
          [signedGuild.signature],
          { waitForConfirmation: false, value: 100000000000000n, customAbi: discordPortalAbi },
        );

        if (receipt.transactionHash) {
          setTxHash(receipt.transactionHash);
          receipt = await waitForTransactionReceipt(wagmiAdapter.wagmiConfig.getClient(), {
            hash: receipt.transactionHash,
          });

          const firstLog = receipt.logs?.[0];
          const attestId = firstLog?.topics[1];
          if (attestId) {
            setAttestationId(attestId);
            onSuccess?.(signedGuild.id, attestId);
          }
        } else {
          setPendingGuildId(null);
          onError?.();
          handleError('Transaction failed. Please try again.');
        }
      } catch (e) {
        setPendingGuildId(null);
        onError?.();
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
        handleError(`Attestation failed: ${errorMessage}`);
      } finally {
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
        const baseUrl =
          chainId === linea.id
            ? 'https://explorer.ver.ax/linea/attestations/'
            : 'https://explorer.ver.ax/linea-sepolia/attestations/';
        window.open(`${baseUrl}${signedGuild.attestationId}`, '_blank');
      }
    },
    [chainId],
  );

  return {
    txHash,
    attestationId,
    pendingGuildId,
    handleAttest,
    handleCheck,
  };
};
