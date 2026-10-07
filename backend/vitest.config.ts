import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // DB testlari bitta bazani ishlatadi — fayllar ketma-ket
    fileParallelism: false,
  },
});
