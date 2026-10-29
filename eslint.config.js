import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist', 'test/fixtures', 'eslint.config.js'],
  },
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: { parserOptions: { project: './tsconfig.json' } },
    rules: {
      complexity: ['error', 15],
      'max-depth': ['error', 3],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
    },
  },
);
