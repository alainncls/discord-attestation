import { createAppKit } from '@reown/appkit/react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { networks, projectId, wagmiAdapter } from './wagmiConfig';
import LineaSepoliaIcon from './assets/linea-sepolia.svg';
import LineaMainnetIcon from './assets/linea-mainnet.svg';

const queryClient = new QueryClient();

const metadata = {
  name: 'Discord Attestation',
  description: 'Issue attestation of your presence in a Discord server',
  url: 'https://discord.alainnicolas.fr',
  icons: ['https://discord.alainnicolas.fr/verax-logo-circle.svg'],
};

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  defaultNetwork: networks[0],
  projectId,
  metadata,
  features: {
    analytics: true,
    email: false,
    socials: false,
    swaps: false,
    onramp: false,
    history: false,
  },
  coinbasePreference: 'eoaOnly',
  themeMode: 'light',
  chainImages: {
    59141: LineaSepoliaIcon,
    59144: LineaMainnetIcon,
  },
});

export function AppKitProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
