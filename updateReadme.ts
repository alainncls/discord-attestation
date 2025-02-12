import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const constantsPath = join(__dirname, '../packages/frontend/src/utils/constants.ts');
const readmePath = join(__dirname, '../README.md');

try {
  const constantsContent = await readFile(constantsPath, 'utf8');

  const portalIdSepoliaMatch = constantsContent.match(
    /export const PORTAL_ID_TESTNET: Address = '([^']+)'/
  );
  if (!portalIdSepoliaMatch) {
    throw new Error('PORTAL_ID_TESTNET not found in constants.ts');
  }

  const portalIdTestnet = portalIdSepoliaMatch[1].toLowerCase();

  const portalIdMainnetMatch = constantsContent.match(
    /export const PORTAL_ID: Address = '([^']+)'/
  );
  if (!portalIdMainnetMatch) {
    throw new Error('PORTAL_ID not found in constants.ts');
  }

  const portalIdMainnet = portalIdMainnetMatch[1].toLowerCase();
  const readmeContent = await readFile(readmePath, 'utf8');

  const updatedReadme = readmeContent
    .replace(
      /`0x[0-9a-fA-F]{40}`]\(https:\/\/explorer\.ver\.ax\/linea-sepolia\/portals\/0x[0-9a-fA-F]{40}\)/,
      `\`${portalIdTestnet}\`](https://explorer.ver.ax/linea-sepolia/portals/${portalIdTestnet})`
    )
    .replace(
      /`0x[0-9a-fA-F]{40}`]\(https:\/\/explorer\.ver\.ax\/linea\/portals\/0x[0-9a-fA-F]{40}\)/,
      `\`${portalIdMainnet}\`](https://explorer.ver.ax/linea/portals/${portalIdMainnet})`
    );

  await writeFile(readmePath, updatedReadme, 'utf8');
  console.log('README.md updated successfully.');
} catch (error) {
  console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
}
