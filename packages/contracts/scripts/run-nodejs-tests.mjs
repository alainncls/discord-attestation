import { spawnSync } from 'node:child_process';

const packageManager = process.env.npm_execpath;
const args = ['exec', 'hardhat', 'test', 'nodejs'];
const result = packageManager
  ? spawnSync(process.execPath, [packageManager, ...args], { encoding: 'utf8' })
  : spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, { encoding: 'utf8' });

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
if (!/\b[1-9]\d* passing\b/.test(result.stdout ?? '')) {
  process.stderr.write('Hardhat discovered no passing Node.js contract tests.\n');
  process.exit(1);
}
