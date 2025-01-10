import React, { ReactNode } from 'react';
import { createWeb3Modal } from '@web3modal/wagmi/react';

import { WagmiProvider } from 'wagmi';
import { lineaSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import LineaMainnetIcon from './assets/linea-mainnet.svg';
import LineaSepoliaIcon from './assets/linea-sepolia.svg';
import { wagmiConfig, walletConnectProjectId } from './wagmiConfig';

const queryClient = new QueryClient();

createWeb3Modal({
  wagmiConfig,
  projectId: walletConnectProjectId,
  enableAnalytics: true,
  defaultChain: lineaSepolia,
  themeMode: 'light',
  chainImages: {
    59144: LineaMainnetIcon,
    59141: LineaSepoliaIcon,
  },
});

interface Web3ModalProviderProps {
  children: ReactNode;
}

export function Web3ModalProvider({ children }: Readonly<Web3ModalProviderProps>) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
