import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Build demo monofichero para el portfolio (jefalcon-web la descarga por tag).
// Todo inlinado en demo/index.html; `npm run build` sigue generando dist/.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    outDir: 'demo',
    emptyOutDir: true,
    assetsInlineLimit: 100 * 1024 * 1024,
    chunkSizeWarningLimit: 1024,
  },
});
