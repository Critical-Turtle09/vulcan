import { defineConfig } from 'vite';

// Renderer dev server. Electron and the Playwright audit both load this same URL,
// so the operator's full-screen render and the self-screenshot are byte-identical.
export default defineConfig({
  server: { port: 5273, strictPort: true },
  clearScreen: false,
});
