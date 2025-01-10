import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const constantsPath = join(__dirname, '../packages/frontend/src/utils/constants.ts');
const readmePath = join(__dirname, '../README.md');

try {
  const constantsContent = await readFile(constantsPath, 'utf8');

  const portalIdMatch = constantsContent.match(/export const PORTAL_ID: Address = '([^']+)'/);
  if (!portalIdMatch) {
    throw new Error('PORTAL_ID not found in constants.ts');
  }

  const portalId = portalIdMatch[1].toLowerCase();
  const readmeContent = await readFile(readmePath, 'utf8');

  const updatedReadme = readmeContent.replace(
    /`0x[0-9a-fA-F]{40}`]\(https:\/\/explorer\.ver\.ax\/linea-sepolia\/portals\/0x[0-9a-fA-F]{40}\)/,
    `\`${portalId}\`](https://explorer.ver.ax/linea-sepolia/portals/${portalId})`
  );

  await writeFile(readmePath, updatedReadme, 'utf8');
  console.log('README.md updated successfully.');
} catch (error) {
  console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
}
