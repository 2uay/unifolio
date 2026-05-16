import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

// In dev, proxy /api/* straight through to unifolio.ca's deployed Vercel
// serverless functions instead of hitting Yahoo Finance directly. Three
// reasons that beat the previous direct-to-Yahoo approach:
//
//   1. Vercel CDN caches every Yahoo response for 6h (s-maxage=21600), so
//      a refresh costs zero Yahoo requests. The dev box was getting
//      rate-limited (HTTP 429 "Too Many Requests") because every reload
//      escaped to Yahoo fresh.
//   2. The Vercel functions already send the correct desktop UA / headers
//      Yahoo expects. Replicating that in a dev proxy is fragile.
//   3. One target instead of three per-endpoint rewrites — if Yahoo
//      breaks something, the fix happens in api/*.js and dev/prod stay
//      identical.
//
// The prod functions set Access-Control-Allow-Origin:* so a localhost
// fetch returns clean JSON. The cost is one extra hop (dev → unifolio.ca
// → Yahoo), but with the 6h edge cache that's a non-issue.
const PROD_API_TARGET = 'https://unifolio.ca';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: PROD_API_TARGET,
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
