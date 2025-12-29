import { useMemo } from 'react';
import { VeraxSdk } from '@verax-attestation-registry/verax-sdk';
import type { Address } from 'viem';
import { linea } from 'wagmi/chains';

export const useVeraxSdk = (chainId?: number, address?: Address) => {
  const veraxSdk = useMemo(() => {
    if (!chainId || !address) {
      return undefined;
    }

    const sdkConf =
      chainId === linea.id
        ? VeraxSdk.DEFAULT_LINEA_MAINNET_FRONTEND
        : VeraxSdk.DEFAULT_LINEA_SEPOLIA_FRONTEND;

    return new VeraxSdk(sdkConf, address);
  }, [chainId, address]);

  return { veraxSdk };
};
