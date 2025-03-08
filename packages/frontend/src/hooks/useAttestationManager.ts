import { Abi, Hex } from 'viem';
import { useAccount } from 'wagmi';
import { waitForTransactionReceipt } from 'viem/actions';
import { add } from 'date-fns';
import { useState, useCallback } from 'react';
import { VeraxSdk } from '@verax-attestation-registry/verax-sdk';
import { SignedGuild } from '../types';
import { PORTAL_ID, PORTAL_ID_TESTNET, SCHEMA_ID } from '../utils/constants';
import { wagmiAdapter } from '../wagmiConfig';
import { abi as discordPortalAbi } from '../../../contracts/artifacts/src/DiscordPortal.sol/DiscordPortal.json';

export const useAttestationManager = (veraxSdk?: VeraxSdk, chainId?: number) => {
  const { address, isConnected } = useAccount();
  const [txHash, setTxHash] = useState<Hex>();
  const [attestationId, setAttestationId] = useState<Hex>();

  const issueAttestation = useCallback(
    async (signedGuild: SignedGuild, onSuccess?: (guildId: string, attestId: Hex) => void) => {
      if (!address || !veraxSdk) return;

      try {
        setTxHash(undefined);
        setAttestationId(undefined);

        let receipt = await veraxSdk.portal.attest(
          chainId === 59144 ? PORTAL_ID : PORTAL_ID_TESTNET,
          {
            schemaId: SCHEMA_ID,
            expirationDate: Math.floor(add(new Date(), { months: 1 }).getTime() / 1000),
            subject: address,
            attestationData: [{ guildId: signedGuild.id, guildName: signedGuild.name }],
          },
          [signedGuild.signature],
          false,
          100000000000000n,
          discordPortalAbi as Abi,
        );

        if (receipt.transactionHash) {
          setTxHash(receipt.transactionHash);
          receipt = await waitForTransactionReceipt(wagmiAdapter.wagmiConfig.getClient(), {
            hash: receipt.transactionHash,
          });

          const attestId = receipt.logs?.[0].topics[1];
          setAttestationId(attestId);

          if (attestId && onSuccess) {
            onSuccess(signedGuild.id, attestId);
          }
        } else {
          alert(`Oops, something went wrong!`);
        }
      } catch (e) {
        if (e instanceof Error) alert(`Oops, something went wrong: ${e.message}`);
      }
    },
    [address, chainId, veraxSdk],
  );

  const handleAttest = useCallback(
    async (signedGuild: SignedGuild, onSuccess?: (guildId: string, attestId: Hex) => void) => {
      if (isConnected) {
        await issueAttestation(signedGuild, onSuccess);
      }
    },
    [isConnected, issueAttestation],
  );

  const handleCheck = useCallback(
    (signedGuild: SignedGuild) => {
      if (signedGuild.attestationId) {
        window.open(
          `https://explorer.ver.ax/linea${chainId === 59144 ? '' : '-sepolia'}/attestations/${signedGuild.attestationId}`,
          '_blank',
        );
      }
    },
    [chainId],
  );

  return {
    txHash,
    attestationId,
    handleAttest,
    handleCheck,
  };
};
