// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import i18next from 'eslint-plugin-i18next';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['backend/**/*.{ts,mjs}', 'scripts/**/*.mjs', '*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['frontend/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // R-I18N-05: sahifa va komponentlarda JSX ichida qattiq yozilgan matn taqiqlanadi
    files: ['frontend/src/pages/**/*.tsx', 'frontend/src/components/**/*.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          // Atributlardan faqat foydalanuvchiga ko'rinadiganlari tekshiriladi (yo'llar, kalitlar emas)
          'jsx-attributes': {
            include: ['title', 'placeholder', 'alt', 'aria-label', 'aria-description', 'label'],
          },
        },
      ],
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // CLI skriptlar konsolga yozadi
    files: ['**/scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
  prettier,
);
