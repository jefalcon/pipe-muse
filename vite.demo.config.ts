import { defineConfig } from 'vite';

// Build de la demo para el portfolio (jefalcon-web la descarga por tag).
// Sin nada inline (CSP estricta: script-src/style-src 'self'): JS y CSS van
// a demo/assets/ con nombres fijos, para que games.config.json pueda listarlos.
// `npm run build` sigue generando dist/.
export default defineConfig({
  base: './',
  build: {
    outDir: 'demo',
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        entryFileNames: 'assets/pipe-muse.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
