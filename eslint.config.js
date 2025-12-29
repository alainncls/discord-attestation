import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Base ESLint configuration for the monorepo.
 * Individual packages extend this configuration with their own rules.
 */
export const baseConfig = tseslint.config({
  extends: [js.configs.recommended, ...tseslint.configs.recommended],
  files: ['**/*.{ts,tsx}'],
  languageOptions: {
    ecmaVersion: 2022,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
  },
});

export default baseConfig;

