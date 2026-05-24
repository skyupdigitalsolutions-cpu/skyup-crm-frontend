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