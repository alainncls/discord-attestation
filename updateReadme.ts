import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const constantsPath = path.join(
  __dirname,
  '../packages/frontend/src/utils/constants.ts',
);
const readmePath = path.join(__dirname, '../README.md');

fs.readFile(constantsPath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading constants.ts:', err);
    return;
  }

  const portalIdMatch = data.match(
    /export const PORTAL_ID: Address = '([^']+)'/,
  );
  if (!portalIdMatch) {
    console.error('PORTAL_ID not found in constants.ts');
    return;
  }
  const portalId = portalIdMatch[1].toLowerCase();

  fs.readFile(readmePath, 'utf8', (err, readmeData) => {
    if (err) {
      console.error('Error reading README.md:', err);
      return;
    }

    const updatedReadme = readmeData.replace(
      /`0x[0-9a-fA-F]{40}`]\(https:\/\/explorer\.ver\.ax\/linea-sepolia\/portals\/0x[0-9a-fA-F]{40}\)/,
      `\`${portalId}\`](https://explorer.ver.ax/linea-sepolia/portals/${portalId})`,
    );

    fs.writeFile(readmePath, updatedReadme, 'utf8', (err) => {
      if (err) {
        console.error('Error writing README.md:', err);
      } else {
        console.log('README.md updated successfully.');
      }
    });
  });
});
