import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Tauri erwartet einen festen Port (1420) und ein statisches `dist/`-Verzeichnis.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
  server: {
    port: 1420,
    strictPort: true,
    host: false,
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    emptyOutDir: true,
    sourcemap: false,
  },
});
