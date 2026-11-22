import { defineConfig } from 'eslint/config';
import { baseConfig, prettier } from '../../eslint.config.js';

export default defineConfig(
  { ignores: ['typechain-types', 'node_modules', 'artifacts', 'cache'] },
  baseConfig,
  prettier,
);
