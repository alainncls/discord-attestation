module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true,
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    'no-debugger': 'warn',
    'no-duplicate-imports': 'error',
    'no-unused-private-class-members': 'error',
    'prefer-const': 'error',
  },
  ignorePatterns: ['dist', 'node_modules', '*.js', '*.cjs'],
  overrides: [
    {
      files: ['packages/frontend/**/*.{ts,tsx}'],
      extends: ['plugin:react-hooks/recommended', 'plugin:react/recommended'],
      plugins: ['react-refresh'],
      rules: {
        'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
        'react/react-in-jsx-scope': 'off',
        'react/prop-types': 'off',
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
        'react/no-unknown-property': ['error', { ignore: ['css'] }],
        '@typescript-eslint/no-non-null-assertion': 'off'
      },
      settings: {
        react: {
          version: 'detect',
        },
      },
    },
    {
      files: ['packages/contracts/**/*.ts'],
      env: {
        mocha: true,
      },
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
        'no-unused-expressions': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    },
  ],
};
