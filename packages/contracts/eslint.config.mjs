import { baseConfig } from '../../eslint.config.js';

export default [
  { ignores: ['typechain-types', 'node_modules', 'artifacts', 'cache'] },
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
