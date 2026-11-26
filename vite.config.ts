import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Served from the root of its host everywhere except GitHub Pages, which puts
// the project at /World-network/; deploy.yml sets VITE_BASE_PATH for that build.
export default defineConfig(() => ({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: {
    host: true, // expose on the LAN so a phone on the same WiFi can reach it
  },
}))
