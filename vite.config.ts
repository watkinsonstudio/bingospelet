/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Kör med `--mode singlefile` för att baka in allt i en enda self-contained
// HTML-fil (för förhandsvisning/testning utan server). Se .env.singlefile.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'singlefile' ? [viteSingleFile()] : [])],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
