import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE is set by the GitHub Actions workflow (e.g. "/my-repo/").
// Locally it defaults to "/".
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: env.VITE_BASE || '/',
    plugins: [react()],
    test: { include: ['tests/**/*.test.ts'] },
  };
});
