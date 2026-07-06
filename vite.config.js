import { defineConfig } from 'vite';

// Renderer dev server. Electron and the Playwright audit both load this same URL,
// so the operator's full-screen render and the self-screenshot are byte-identical.
// NIGHT II · PART 6 — `base: './'` makes the production build (npm run build:web →
// dist/) reference its assets by RELATIVE path, so the packaged .app can load the
// renderer over file:// (no dev server). Large geojson/topo JSON imports inflate
// the bundle; a raised chunk-size warning limit keeps the build output quiet.
export default defineConfig({
  base: './',
  server: { port: 5273, strictPort: true },
  clearScreen: false,
  build: { outDir: 'dist', chunkSizeWarningLimit: 4096 },
});
