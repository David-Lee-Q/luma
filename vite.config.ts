import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

const apiProxy = {
  '/api': {
    target: 'http://127.0.0.1:8787',
    changeOrigin: true,
  },
  '/docs': {
    target: 'http://127.0.0.1:8787',
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['.cosmoplat.cn', '.cosmoplat.com', '.cosmoplat.net'],
    proxy: apiProxy,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: ['.cosmoplat.cn', '.cosmoplat.com', '.cosmoplat.net'],
    proxy: apiProxy,
  },
})
