// vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    // base: env.VITE_BASE_URL, // Comenta o elimina esta línea
    server: {
      // ...
    },
    build: {
      rollupOptions: {
        output: {
          format: 'es',
        },
      },
    },
  };
});