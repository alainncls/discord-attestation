import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';

// Reown types these fields as `T | undefined`, so WagmiAdapter is not assignable to
// ChainAdapter under exactOptionalPropertyTypes. WagmiAdapter always sets these values.
export class EvmWagmiAdapter extends WagmiAdapter {
  override namespace = 'eip155' as const;
  override adapterType = 'wagmi' as const;
}
