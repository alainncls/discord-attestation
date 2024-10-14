import { useEffect, useState } from 'react';
import { VeraxSdk } from '@verax-attestation-registry/verax-sdk';
import { Address } from 'viem';

export const useVeraxSdk = (chainId?: number, address?: Address) => {
  const [veraxSdk, setVeraxSdk] = useState<VeraxSdk>();

  useEffect(() => {
    if (chainId && address) {
      const sdkConf = chainId === 59144 ? VeraxSdk.DEFAULT_LINEA_MAINNET_FRONTEND : VeraxSdk.DEFAULT_LINEA_SEPOLIA_FRONTEND;
      setVeraxSdk(new VeraxSdk(sdkConf, address));
    }
  }, [chainId, address]);

  return { veraxSdk, setVeraxSdk };
};
