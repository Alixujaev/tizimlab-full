import { defineConfig, devices } from '@playwright/test';

/**
 * P20 (D-199): E2E — Playwright (chromium). Backend (NODE_ENV=test, AI_MOCK=1, mock embedding, disk xotira)
 * alohida e2e bazasida ishga tushadi (`e2e/server.ts` — sxemani qayta yaratadi, migratsiya + seed);
 * frontend — production build + `vite preview` (proksi /api → backend).
 * Barqarorlik: retry YO'Q (flaky yashirilmaydi), kutishlar faqat locator/assert orqali; trace/screenshot — faqat xatoda.
 */
const BACKEND_PORT = 4100;
const FRONTEND_PORT = 5174;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  workers: isCI ? 2 : 3,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: isCI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    locale: 'uz-UZ',
    timezoneId: 'Asia/Tashkent',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
    {
      name: 'telegram-mobile',
      testMatch: /mobile\.spec\.ts/,
      // Telegram WebApp o'lchami (iPhone 12/13 ga yaqin)
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: false,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      command: 'npx tsx e2e/server.ts',
      cwd: '..',
      url: `http://localhost:${BACKEND_PORT}/health`,
      reuseExistingServer: !isCI,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { E2E_BACKEND_PORT: String(BACKEND_PORT), E2E_FRONTEND_PORT: String(FRONTEND_PORT) },
    },
    {
      command: `npm run build -w frontend && npm run preview -w frontend -- --port ${FRONTEND_PORT} --strictPort`,
      cwd: '..',
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: !isCI,
      timeout: 240_000,
      env: { VITE_API_PROXY_TARGET: `http://localhost:${BACKEND_PORT}` },
    },
  ],
});
