import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { APP_VERSION } from './src/version';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'inject-version',
      transformIndexHtml(html) {
        return html
          .replace(/__APP_VERSION__/g, APP_VERSION)
          .replace(/__GA_ID__/g, process.env.VITE_GA_ID || '');
      },
    },
  ],
  server: {
    port: 3000,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
  optimizeDeps: {
    include: [
      'pyodide',
      'wasmoon',
      '@ruby/wasm-wasi',
      '@bjorn3/browser_wasi_shim',
    ],
  },
  worker: {
    format: 'es',
  },
  build: {
    outDir: 'dist',
  },
});
