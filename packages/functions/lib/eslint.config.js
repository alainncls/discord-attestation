import { baseConfig } from '../../../eslint.config.js';

export default [
  { ignores: ['dist', 'node_modules'] },
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];

