import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, 'VITE_');
  // Backend manzili (dev proxy uchun); standart — backend/.env dagi PORT=4000
  const target = env.VITE_API_PROXY_TARGET || 'http://localhost:4000';
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(root, 'src') } },
    server: {
      port: 5173,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/socket.io': { target, changeOrigin: true, ws: true },
      },
    },
    build: {
      rolldownOptions: {
        output: {
          // Kesh uchun barqaror bo'laklar: kutubxonalar va tarjimalar ilova kodidan alohida
          // (sahifalar, jumladan P13 analitika, o'z lazy chunk'larida — D-165)
          codeSplitting: {
            groups: [
              {
                name: 'react',
                test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
              },
              { name: 'vendor', test: /node_modules[\\/]/ },
              { name: 'locales', test: /src[\\/]i18n[\\/]locales[\\/]/ },
            ],
          },
        },
      },
    },
    test: {
      testTimeout: 20000,
      hookTimeout: 20000,
    },
  };
});
