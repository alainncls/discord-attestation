import hre, { network } from 'hardhat';
import { VeraxSdk } from '@verax-attestation-registry/verax-sdk';
import { verifyContract } from '@nomicfoundation/hardhat-verify/verify';
import { isAddress, isHex } from 'viem';

function getEnvAddress(key: string): `0x${string}` {
  const value = process.env[key];
  if (!value || !isAddress(value)) {
    throw new Error(`${key} is not set or is not a valid address`);
  }
  return value;
}

function getEnvHex(key: string): `0x${string}` {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not set`);
  }
  const hexValue = value.startsWith('0x') ? value : `0x${value}`;
  if (!isHex(hexValue)) {
    throw new Error(`${key} is not a valid hex string`);
  }
  return hexValue;
}

async function main() {
  console.log(`START DISCORD SCRIPT`);

  const routerAddress = getEnvAddress('ROUTER_ADDRESS');
  const privateKey = getEnvHex('PRIVATE_KEY');

  console.log('Deploying DiscordPortal.sol...');

  const constructorArguments: [`0x${string}`[], `0x${string}`] = [[], routerAddress];

  const { viem } = await network.connect();

  const discordPortal = await viem.deployContract('DiscordPortal', constructorArguments);
  const discordPortalAddress = discordPortal.address;

  console.log(`DiscordPortal deployed at ${discordPortalAddress}`);

  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log('Verifying contract...');

  await verifyContract(
    {
      address: discordPortalAddress,
      constructorArgs: constructorArguments,
    },
    hre,
  );

  console.log(`DiscordPortal successfully deployed and verified!`);
  console.log(`DiscordPortal is at ${discordPortalAddress}`);

  console.log('Registering DiscordPortal.sol...');

  const walletClients = await viem.getWalletClients();
  const walletClient = walletClients[0];

  if (!walletClient) {
    throw new Error('No wallet client available');
  }

  const signerAddress = walletClient.account.address;
  const networkConfig = hre.config.networks[hre.globalOptions.network ?? 'linea-sepolia'];

  const isLinea =
    networkConfig &&
    'chainId' in networkConfig &&
    typeof networkConfig.chainId === 'number' &&
    networkConfig.chainId === 59144;

  const veraxSdk = new VeraxSdk(
    isLinea ? VeraxSdk.DEFAULT_LINEA_MAINNET : VeraxSdk.DEFAULT_LINEA_SEPOLIA,
    signerAddress,
    privateKey,
  );

  await veraxSdk.portal.register(
    discordPortalAddress,
    'Discord Portal',
    'Discord attestations',
    true,
    'alain.linea.eth',
    { waitForConfirmation: true },
  );

  console.log(`DiscordPortal is registered!`);

  console.log(`END DISCORD SCRIPT`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
