import { defineConfig, configVariable } from 'hardhat/config';
import type { SensitiveString } from 'hardhat/types/config';
import HardhatNodeTestRunner from '@nomicfoundation/hardhat-node-test-runner';
import HardhatViem from '@nomicfoundation/hardhat-viem';
import HardhatVerify from '@nomicfoundation/hardhat-verify';

const getRpcUrl = (envKey: string, fallback: SensitiveString) => {
  const url = process.env[envKey];
  return url === undefined || url === '' ? fallback : url;
};

export default defineConfig({
  plugins: [HardhatNodeTestRunner, HardhatViem, HardhatVerify],
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
    hardhat: {
      type: 'edr-simulated',
      chainType: 'l1',
    },
    'linea-sepolia': {
      type: 'http',
      url: getRpcUrl(
        'LINEA_SEPOLIA_RPC_URL',
        configVariable('INFURA_KEY', { format: 'https://linea-sepolia.infura.io/v3/{variable}' }),
      ),
      accounts: [configVariable('PRIVATE_KEY')],
      chainId: 59141,
    },
    linea: {
      type: 'http',
      url: getRpcUrl(
        'LINEA_RPC_URL',
        configVariable('INFURA_KEY', { format: 'https://linea-mainnet.infura.io/v3/{variable}' }),
      ),
      accounts: [configVariable('PRIVATE_KEY')],
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
