import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// GitHub Pages serves this project at /World-network/. Dev stays at / so
// localhost URLs and the LAN preview are unchanged.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/World-network/' : '/',
  plugins: [react()],
  server: {
    host: true, // expose on the LAN so a phone on the same WiFi can reach it
  },
}))
