import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Mirror the Cloudflare Pages Function at functions/api/ndbc.ts so dev and
    // production hit the same URL. NDBC sends no CORS header, so the browser
    // can only read it through a same-origin proxy.
    proxy: {
      '/api/ndbc': {
        target: 'https://www.ndbc.noaa.gov',
        changeOrigin: true,
        rewrite: () => '/data/latest_obs/latest_obs.txt',
        headers: { 'User-Agent': 'CanalPulse/1.0 (dev proxy)' },
      },
    },
  },
})
