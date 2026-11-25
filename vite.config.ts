import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const apiUpstream = process.env.DCP_API_UPSTREAM
    ?? loadEnv(mode, process.cwd(), 'DCP_API_UPSTREAM').DCP_API_UPSTREAM;

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    build: {
      rollupOptions: { output: { manualChunks(id) {
        if (id.includes('/node_modules/zod/')) return 'schema-validation';
        if (id.includes('/src/locales/')) return 'localization';
      } } },
    },
    server: {
      watch: { ignored: /(^|[\\/])\.local(?:[\\/]|$)/ },
      proxy: apiUpstream ? {
        '/api': { target: apiUpstream, changeOrigin: false },
      } : undefined,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.test.{ts,tsx}'],
    },
  };
});
