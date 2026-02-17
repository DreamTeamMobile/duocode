import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.{js,jsx,ts,tsx}', 'src/**/*.test.{js,jsx,ts,tsx}'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx,ts,tsx}', 'server/*.js'],
      exclude: ['vitest.config.ts', 'vite.config.ts', 'node_modules/**', 'tests/**']
    },
    setupFiles: ['tests/unit/setup.ts']
  }
});
