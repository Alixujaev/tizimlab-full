// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import i18next from 'eslint-plugin-i18next';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * D-158: hali @/ui ga ko'chirilmagan fayllar (native element qoidasi vaqtincha o'chiq).
 * Har ko'chirishdan keyin ro'yxat qisqaradi; UI qayta qurish oxirida BO'SH bo'lishi shart.
 */
const LEGACY_UI_FILES = [
  'frontend/src/pages/activity/ActivityPage.tsx',
  'frontend/src/pages/audit/AuditLogPage.tsx',
  'frontend/src/pages/audit/LogDetailsModal.tsx',
  'frontend/src/pages/companies/CompaniesPage.tsx',
  'frontend/src/pages/companies/CompanyConfirmModal.tsx',
  'frontend/src/pages/companies/CompanyFormModal.tsx',
  'frontend/src/pages/profile/ProfilePage.tsx',
  'frontend/src/pages/stability/CreateCheckpointModal.tsx',
  'frontend/src/pages/stability/CreateStudyModal.tsx',
  'frontend/src/pages/stability/RecordResultsModal.tsx',
  'frontend/src/pages/stability/StabilityDetailPage.tsx',
  'frontend/src/pages/stability/StabilityPage.tsx',
  'frontend/src/pages/temperature/ManualReadingModal.tsx',
  'frontend/src/pages/temperature/ResolveAlertModal.tsx',
  'frontend/src/pages/temperature/SensorConfigModal.tsx',
  'frontend/src/pages/temperature/TemperaturePage.tsx',
  'frontend/src/pages/users/PermissionsModal.tsx',
  'frontend/src/pages/users/ResetPasswordModal.tsx',
  'frontend/src/pages/users/UserFormModal.tsx',
  'frontend/src/pages/users/UserLogsModal.tsx',
  'frontend/src/pages/users/UsersPage.tsx',
];

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['backend/**/*.{ts,mjs}', 'scripts/**/*.{ts,mjs}', '*.mjs'],
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
    // src/ui komponentlari ham foydalanuvchiga ko'rinadigan matnni faqat t() orqali chiqaradi
    files: ['frontend/src/ui/**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': {
            include: ['title', 'placeholder', 'alt', 'aria-label', 'aria-description', 'label'],
          },
        },
      ],
    },
  },
  {
    // D-158: yangi UI faqat @/ui komponentlaridan — native element va brauzer dialoglari taqiqlangan
    files: ['frontend/src/**/*.{ts,tsx}'],
    ignores: ['frontend/src/ui/**', ...LEGACY_UI_FILES],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXOpeningElement[name.name=/^(select|button|input|textarea|table)$/]',
          message:
            "Native <select>/<button>/<input>/<textarea>/<table> o'rniga @/ui komponentini ishlating (Select, Button, Input, Textarea, DataTable ...).",
        },
        {
          selector:
            "CallExpression[callee.object.name='window'][callee.property.name=/^(alert|confirm|prompt)$/]",
          message:
            "window.alert/confirm/prompt o'rniga notify (Toast) yoki ConfirmDialog ishlating.",
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'alert', message: "alert() o'rniga notify (Toast) ishlating." },
        { name: 'confirm', message: "confirm() o'rniga ConfirmDialog ishlating." },
        { name: 'prompt', message: "prompt() o'rniga Modal + FormField ishlating." },
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
    files: ['**/scripts/**/*.{mjs,ts}'],
    rules: { 'no-console': 'off' },
  },
  prettier,
);
