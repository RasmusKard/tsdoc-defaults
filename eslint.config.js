import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['dist', 'site', 'test/fixtures', 'eslint.config.js'],
  },
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: { parserOptions: { project: './tsconfig.json' } },
    rules: {
      complexity: ['error', 15],
      'max-depth': ['error', 3],
    },
  },
);
