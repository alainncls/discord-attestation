import { ethers, network, run } from 'hardhat';
import dotenv from 'dotenv';
import { VeraxSdk } from '@verax-attestation-registry/verax-sdk';
import { Address, Hex } from 'viem';

dotenv.config({ path: '../.env' });

async function main() {
  console.log(`START DISCORD SCRIPT`);

  const { ROUTER_ADDRESS, PRIVATE_KEY } = process.env;

  if (!ROUTER_ADDRESS || ROUTER_ADDRESS === '') {
    throw new Error('ROUTER_ADDRESS is not set in .env file');
  }

  if (!PRIVATE_KEY || PRIVATE_KEY === '') {
    throw new Error('PRIVATE_KEY is not set in .env file');
  }

  console.log('Deploying DiscordPortal.sol...');

  const constructorArguments = [[], ROUTER_ADDRESS];

  const discordPortal = await ethers.deployContract(
    'DiscordPortal',
    constructorArguments,
  );
  await discordPortal.waitForDeployment();
  const discordPortalAddress = (await discordPortal.getAddress()) as Address;

  await new Promise((resolve) => setTimeout(resolve, 3000));

  await run('verify:verify', {
    address: discordPortalAddress,
    constructorArguments: constructorArguments,
  });

  console.log(`DiscordPortal successfully deployed and verified!`);
  console.log(`DiscordPortal is at ${discordPortalAddress}`);

  console.log('Registering DiscordPortal.sol...');

  const chainId = network.config.chainId;
  const signers = await ethers.getSigners();
  const signer = signers[0];
  const veraxSdk = new VeraxSdk(
    chainId === 59144
      ? VeraxSdk.DEFAULT_LINEA_MAINNET
      : VeraxSdk.DEFAULT_LINEA_TESTNET,
    signer.address as Address,
    PRIVATE_KEY as Hex,
  );

  await veraxSdk.portal.register(
    discordPortalAddress,
    'eFrogs Portal',
    'eFrogs attestations',
    true,
    'alainnicolas.eth',
    true,
  );

  console.log(`DiscordPortal is registered!`);

  console.log(`END DISCORD SCRIPT`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
