import { defineConfig } from 'eslint/config';
import { baseConfig, prettier } from '../../../eslint.config.js';

export default defineConfig({ ignores: ['dist', 'node_modules'] }, baseConfig, prettier);
