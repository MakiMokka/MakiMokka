import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react/no-danger': 'error',
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      // Security guardrails (see docs/SECURITY.md).
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Never persist credentials or mail data in web storage.' },
        {
          name: 'sessionStorage',
          message: 'Never persist credentials or mail data in web storage.',
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'localStorage', message: 'Web storage is not allowed.' },
        { object: 'window', property: 'sessionStorage', message: 'Web storage is not allowed.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/ssr',
              importNames: ['createBrowserClient'],
              message:
                'Auth runs server-side only; session cookies are HttpOnly and unreadable by browser code.',
            },
          ],
        },
      ],
    },
  },
  {
    // The logger is the single place allowed to write to the console.
    files: ['src/lib/logging/logger.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // Test code may log and may inspect web storage to assert it is empty.
    files: ['tests/**', '**/*.test.ts', '**/*.test.tsx', 'scripts/**'],
    rules: {
      'no-console': 'off',
      'no-restricted-properties': 'off',
      'no-restricted-globals': 'off',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts']),
]);

export default eslintConfig;
