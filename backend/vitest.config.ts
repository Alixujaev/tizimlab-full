import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // DB testlari bitta bazani ishlatadi — fayllar ketma-ket
    fileParallelism: false,
    // Izolyatsiyalangan sxemada noldan migratsiya + ETL (odatda ~2 s) lokal Docker/Windows'da 5 s standartdan
    // oshib ketishi mumkin (P20 da lokal DB testlari yoqilganda kuzatildi) — frontend bilan bir xil chegara
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
