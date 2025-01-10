import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { lineaSepolia, mainnet } from 'wagmi/chains';
import { http } from 'wagmi';

export const walletConnectProjectId = 'e6b9b6d71d0c99dd038d98f51468f741';
const infuraApiKey: string = '4822fb98767a4bc295a375e6855e0375';

const metadata = {
  name: 'Discord Attestation',
  description: 'Issue attestation of your presence in a Discord server',
  url: 'https://discord.alainnicolas.fr', // origin must match your domain & subdomain
  icons: ['https://avatars.githubusercontent.com/u/37784886'],
};
const chains = [lineaSepolia, mainnet] as const;
export const wagmiConfig = defaultWagmiConfig({
  projectId: walletConnectProjectId,
  metadata,
  enableCoinbase: false,
  chains,
  transports: {
    [mainnet.id]: http(`https://mainnet.infura.io/v3/${infuraApiKey}`),
    [lineaSepolia.id]: http(`https://linea-sepolia.infura.io/v3/${infuraApiKey}`),
  },
});
