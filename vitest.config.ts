import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['test/setupTests.ts'],
    include: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.{spec,test}.{ts,tsx}'],
    clearMocks: true,
    watch: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
