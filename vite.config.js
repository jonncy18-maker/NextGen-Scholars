import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  base: '/NextGen-Scholars/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        claire: resolve(__dirname, 'claire.html'),
        april: resolve(__dirname, 'april.html'),
        navigator: resolve(__dirname, 'navigator.html'),
      },
    },
  },
})
