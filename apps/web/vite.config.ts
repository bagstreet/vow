import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@vow/core': path.resolve(__dirname, '../../packages/core'), '@vow/presets': path.resolve(__dirname, '../../packages/presets') },
  },
  server: { fs: { allow: ['../..'] } },
})
