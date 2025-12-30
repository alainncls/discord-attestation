import { defineConfig, configVariable } from 'hardhat/config';
import type { SensitiveString } from 'hardhat/types/config';
import HardhatViem from '@nomicfoundation/hardhat-viem';
import HardhatVerify from '@nomicfoundation/hardhat-verify';

export default defineConfig({
  plugins: [HardhatViem, HardhatVerify],
  solidity: {
    compilers: [
      {
        version: '0.8.21',
        settings: {
          evmVersion: 'shanghai',
          optimizer: {
            enabled: true,
            runs: 2000,
          },
        },
      },
    ],
  },
  networks: {
    'linea-sepolia': {
      type: 'http',
      url: configVariable('INFURA_KEY', 'https://linea-sepolia.infura.io/v3/{variable}'),
      accounts: [configVariable('PRIVATE_KEY') as SensitiveString],
      chainId: 59141,
    },
    linea: {
      type: 'http',
      url: configVariable('INFURA_KEY', 'https://linea-mainnet.infura.io/v3/{variable}'),
      accounts: [configVariable('PRIVATE_KEY') as SensitiveString],
      chainId: 59144,
    },
  },
  paths: {
    sources: './src',
  },
  verify: {
    etherscan: {
      apiKey: configVariable('ETHERSCAN_API_KEY'),
    },
  },
});
