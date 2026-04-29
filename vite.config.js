import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [react(), nodePolyfills()],
  appType: 'spa',   // ← tells Vite's preview server to serve index.html for all 404s
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['all'],
  },
  preview: {
    host: true,
    port: 4173,
  },
})