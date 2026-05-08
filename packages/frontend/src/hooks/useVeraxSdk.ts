import { useEffect, useState } from 'react';
import type { Address } from 'viem';
import { linea } from 'wagmi/chains';
import type { VeraxSdk } from '@verax-attestation-registry/verax-sdk';

export const useVeraxSdk = (chainId?: number, address?: Address) => {
  const sdkKey = chainId && address ? `${chainId}:${address}` : undefined;
  const [sdkState, setSdkState] = useState<{ key: string; sdk: VeraxSdk }>();
  const veraxSdk = sdkState && sdkState.key === sdkKey ? sdkState.sdk : undefined;

  useEffect(() => {
    let isCurrent = true;

    if (!sdkKey || !chainId || !address) {
      return () => {
        isCurrent = false;
      };
    }

    void import('@verax-attestation-registry/verax-sdk').then(({ VeraxSdk }) => {
      if (!isCurrent) {
        return;
      }

      const sdkConf =
        chainId === linea.id
          ? VeraxSdk.DEFAULT_LINEA_MAINNET_FRONTEND
          : VeraxSdk.DEFAULT_LINEA_SEPOLIA_FRONTEND;

      setSdkState({ key: sdkKey, sdk: new VeraxSdk(sdkConf, address) });
    });

    return () => {
      isCurrent = false;
    };
  }, [sdkKey, chainId, address]);

  return { veraxSdk };
};
