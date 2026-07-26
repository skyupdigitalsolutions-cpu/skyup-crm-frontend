import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ── Backend URL for the dev proxy ─────────────────────────────────────────────
// In local dev, all /api calls are proxied to localhost:5000 so you never
// hit CORS errors. In production (Render) the VITE_API_URL env var is used
// directly by axiosConfig.js, so this proxy block has no effect there.
const BACKEND_DEV_URL = 'http://localhost:5000'

export default defineConfig({
  plugins: [react()],
  appType: 'spa',

  // ── Production build tuning ────────────────────────────────────────────────
  // Split heavy, rarely-changing vendor code into its own cacheable chunks so
  // the entry bundle stays small and app redeploys don't force users to
  // re-download React / charting libs. Route pages are already code-split via
  // React.lazy() in App.jsx, so those stay in their own per-route chunks.
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-router')) return 'vendor-router';
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/')
          ) return 'vendor-react';
          if (id.includes('chart.js')) return 'vendor-charts';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('socket.io')) return 'vendor-socket';
          if (id.includes('axios')) return 'vendor-axios';
          return 'vendor';
        },
      },
    },
  },

  server: {
    host: true,
    port: 5173,
    allowedHosts: ['all'],

    proxy: {
      // All /api/* requests → Express backend (no CORS, same origin in browser)
      '/api': {
        target: BACKEND_DEV_URL,
        changeOrigin: true,
        secure: false,
      },

      // Socket.IO live updates
      '/socket.io': {
        target: BACKEND_DEV_URL,
        changeOrigin: true,
        ws: true,          // upgrade HTTP → WebSocket
        secure: false,
      },

      // Static file routes served by the backend
      '/recordings': {
        target: BACKEND_DEV_URL,
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: BACKEND_DEV_URL,
        changeOrigin: true,
        secure: false,
      },

      // Webhook routes (useful for testing with ngrok in dev)
      '/meta': {
        target: BACKEND_DEV_URL,
        changeOrigin: true,
        secure: false,
      },
      '/msg91-webhook': {
        target: BACKEND_DEV_URL,
        changeOrigin: true,
        secure: false,
      },
      '/website-webhook': {
        target: BACKEND_DEV_URL,
        changeOrigin: true,
        secure: false,
      },
    },
  },

  preview: {
    host: true,
    port: 4173,
  },
})
