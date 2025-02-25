import { lineaSepolia, mainnet } from 'wagmi/chains';
import { AppKitNetwork } from '@reown/appkit/networks';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { http } from 'viem';

export const projectId = 'e6b9b6d71d0c99dd038d98f51468f741';
const infuraApiKey: string = '4822fb98767a4bc295a375e6855e0375';

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [lineaSepolia, mainnet];

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  transports: {
    [lineaSepolia.id]: http(`https://linea-sepolia.infura.io/v3/${infuraApiKey}`),
    [mainnet.id]: http(`https://mainnet.infura.io/v3/${infuraApiKey}`),
  },
});
