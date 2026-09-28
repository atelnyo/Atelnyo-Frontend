import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Codespace hostname for HMR WebSocket
const codespaceHost = process.env.CODESPACES && process.env.CODESPACE_NAME
  ? `${process.env.CODESPACE_NAME}-3000.app.github.dev`
  : null;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // ─── Vitest (T031) — unit tests for hooks/utils/services ───
  // jsdom environment; setup file loads jest-dom matchers. Tests live
  // co-located as src/**/*.test.js(x).
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
    include: ['src/**/*.test.{js,jsx}'],
    exclude: ['node_modules', 'e2e'],
  },
  base: '/',
  server: {
    host: '0.0.0.0',
    port: 3000,
    hmr: codespaceHost
      ? { host: codespaceHost, clientPort: 443, protocol: 'wss', path: '/__vite_hmr' }
      : true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true, proxyTimeout: 60000 },
      '/ws': { target: 'ws://127.0.0.1:8000', ws: true, changeOrigin: true }
    }
  },
  build: {
    // Target modern browsers — smaller bundles, no polyfills for IE11
    target: 'es2020',
    // Enable CSS code splitting (each lazy route gets its own CSS chunk)
    cssCodeSplit: true,
    // Source maps only in dev (prod builds are smaller without them)
    sourcemap: false,
    // Use esbuild for minification (faster than terser, no extra deps)
    minify: 'esbuild',
    esbuild: {
      drop: ['console.debug', 'debugger'],
    },
    // Asset inlining — small assets (<4KB) are inlined as base64 to reduce HTTP requests
    assetsInlineLimit: 4096,
    // ─── Performance Budget ─────────────────────────────────────
    // Warn when chunks exceed limits. These thresholds target:
    //   • Main bundle: < 500 KB gzipped (good LCP)
    //   • Any single chunk: < 150 KB gzipped (fast parsing)
    //   • Total JS: < 2 MB gzipped (acceptable for a feature-rich SPA)
    //
    // To enforce (fail build on violation), use a plugin like
    // vite-plugin-budget or rollup-plugin-visualizer in CI.
    chunkSizeWarningLimit: 500,
    // Report chunk sizes in build output for monitoring
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        // Split vendor libraries into separate cacheable chunks for optimal
        // browser caching. Each chunk gets its own hash so library updates
        // only invalidate the affected chunk.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          // ─── Note: hls.js, dashjs, @mux/* are intentionally NOT
          //       forced into vendor-* chunks. They are transitive
          //       deps of react-player (which is lazy-loaded in
          //       shared.jsx). Keeping them here would bloat the
          //       initial bundle by ~1.4 MB (gzip ~430 KB). ─────
          // ─── Vendor chunks (always loaded) ──────────────────
          if (/node_modules\/@?firebase\//.test(id)) return 'vendor-firebase';
          if (/node_modules\/@?sentry(-internal)?\//.test(id)) return 'vendor-sentry';
          if (/node_modules\/react(-dom|-router|-helmet)?/.test(id)) return 'vendor-react';
          if (/node_modules\/(axios|@google\/generativeai)/.test(id)) return 'vendor-api';
        },
      },
    },
  },
})
