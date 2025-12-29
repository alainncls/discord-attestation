import { linea, lineaSepolia, mainnet } from 'wagmi/chains';
import type { AppKitNetwork } from '@reown/appkit/networks';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { http } from 'viem';

// Validate required environment variables
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
const infuraApiKey = import.meta.env.VITE_INFURA_API_KEY;

if (!walletConnectProjectId) {
  throw new Error('Missing VITE_WALLETCONNECT_PROJECT_ID environment variable');
}

if (!infuraApiKey) {
  throw new Error('Missing VITE_INFURA_API_KEY environment variable');
}

export const projectId = walletConnectProjectId;

// Networks: Linea (mainnet + testnet) + Ethereum mainnet for ENS resolution
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [linea, lineaSepolia, mainnet];

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  transports: {
    [linea.id]: http(`https://linea-mainnet.infura.io/v3/${infuraApiKey}`, {
      timeout: 10_000,
      retryCount: 3,
      retryDelay: 1_000,
    }),
    [lineaSepolia.id]: http(`https://linea-sepolia.infura.io/v3/${infuraApiKey}`, {
      timeout: 10_000,
      retryCount: 3,
      retryDelay: 1_000,
    }),
    [mainnet.id]: http(`https://mainnet.infura.io/v3/${infuraApiKey}`, {
      timeout: 10_000,
      retryCount: 3,
      retryDelay: 1_000,
    }),
  },
});
