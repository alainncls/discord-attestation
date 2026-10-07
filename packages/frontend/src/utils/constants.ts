import type { Address, Hex } from 'viem';
import { linea, lineaSepolia } from 'wagmi/chains';

export const PORTAL_ID_TESTNET: Address = '0xf22f348C9257F418509eC03d6BC0C31A20Bd9E46';
export const PORTAL_ID: Address = '0x6C3Ba43a3c4aC6579D44Baeb84e9CFC23654964f';
export const SCHEMA_ID: Hex = '0xefa96ce61912c5bb59cb4c26645ea193fc03a234fe09a6b2c8b85aaa51a382d6';

/** Verax AttestationRegistry on Linea mainnet (`VeraxSdk.DEFAULT_LINEA_MAINNET`). */
export const LINEA_MAINNET_ATTESTATION_REGISTRY: Address =
  '0x3de3893aa4Cdea029e84e75223a152FD08315138';
/** Verax AttestationRegistry on Linea Sepolia (`VeraxSdk.DEFAULT_LINEA_SEPOLIA`). */
export const LINEA_SEPOLIA_ATTESTATION_REGISTRY: Address =
  '0xDaf3C3632327343f7df0Baad2dc9144fa4e1001F';

/** keccak256("AttestationRegistered(bytes32)") from the Verax AttestationRegistry. */
export const ATTESTATION_REGISTERED_EVENT_TOPIC: Hex =
  '0xfe10586889e06530420fe4a0d86aa4f7afc3c9dc84b0c77b731a9615496ef18a';

export const getAttestationRegistryAddress = (chainId?: number): Address | undefined => {
  if (chainId === linea.id) return LINEA_MAINNET_ATTESTATION_REGISTRY;
  if (chainId === lineaSepolia.id) return LINEA_SEPOLIA_ATTESTATION_REGISTRY;
  return undefined;
};
