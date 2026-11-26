import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const apiUpstream = process.env.DCP_API_UPSTREAM
    ?? loadEnv(mode, process.cwd(), 'DCP_API_UPSTREAM').DCP_API_UPSTREAM;
  const ownerUpstreams = {
    '^/api/(servicemanagement|cacheservice|queueservice|memorytableservice)/': 9500,
    '^/api/workflow/': 9120,
    '^/api/jsonobject/': 9130,
    '^/api/report/': 9650,
    '^/api/agent/': 9800,
    '^/api/aiframework/': 9920,
  };

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
        ...Object.fromEntries(Object.entries(ownerUpstreams).map(([path, port]) =>
          [path, { target: 'http://127.0.0.1:' + port, changeOrigin: false }])),
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
