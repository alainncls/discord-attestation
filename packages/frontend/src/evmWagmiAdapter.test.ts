import { describe, expect, it } from 'vitest';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { http } from 'viem';
import { linea, lineaSepolia } from 'viem/chains';
import { EvmWagmiAdapter } from './evmWagmiAdapter';

describe('EvmWagmiAdapter', () => {
  it('keeps the values WagmiAdapter sets at runtime', () => {
    const options = {
      projectId: 'test',
      networks: [linea, lineaSepolia] as [typeof linea, typeof lineaSepolia],
      transports: {
        [linea.id]: http('http://127.0.0.1:1'),
        [lineaSepolia.id]: http('http://127.0.0.1:1'),
      },
    };
    const base = new WagmiAdapter(options);
    const evm = new EvmWagmiAdapter(options);
    expect([evm.namespace, evm.adapterType]).toEqual([base.namespace, base.adapterType]);
  });
});
