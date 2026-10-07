import { defineConfig } from 'vitest/config';

// P1 da React Testing Library uchun environment 'jsdom' ga o'tkaziladi
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
  },
});
