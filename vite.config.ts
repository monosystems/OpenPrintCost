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
    // Auf allen Interfaces lauschen, damit die Oberfläche auch von einem
    // anderen Rechner im Netz geöffnet werden kann (mit VITE_MOCK_API=1).
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    emptyOutDir: true,
    sourcemap: false,
  },
});
