module.exports = {
  root: false,
  overrides: [
    {
      files: ['src/**/*.ts'],
      env: {
        node: true,
      },
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
        'no-unused-vars': ['error', {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        }],
      },
    },
  ],
}
