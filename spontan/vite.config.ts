/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Fristående app – delar inget bygge med Sommarbingo i repo-roten.
// Kör med `--mode singlefile` för att baka in allt i en enda self-contained
// HTML-fil (för förhandsvisning utan server). Se .env.singlefile.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'singlefile' ? [viteSingleFile()] : [])],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
