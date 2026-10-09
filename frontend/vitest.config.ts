import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(root, 'src') } },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    // Sekin forma testlari (userEvent.type) to'liq to'plamda 5s dan oshadi; vitest shu faylni o'qiydi
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
