import { type Address, type Hex, isAddressEqual } from 'viem';
import { ATTESTATION_REGISTERED_EVENT_TOPIC, getAttestationRegistryAddress } from './constants';

export type AttestationReceiptLog = {
  address?: Address;
  topics?: readonly Hex[];
};

export const extractAttestationIdFromReceipt = (
  chainId: number | undefined,
  logs: readonly AttestationReceiptLog[] | undefined,
): Hex | undefined => {
  const attestationRegistryAddress = getAttestationRegistryAddress(chainId);
  if (!attestationRegistryAddress || !logs) return undefined;

  const attestationLog = logs.find((log) => {
    const topic = log.topics?.[0]?.toLowerCase();
    return (
      log.address !== undefined &&
      isAddressEqual(log.address, attestationRegistryAddress) &&
      topic === ATTESTATION_REGISTERED_EVENT_TOPIC
    );
  });

  return attestationLog?.topics?.[1];
};
