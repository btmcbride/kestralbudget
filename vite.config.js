import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    allowedHosts: ['kestralbudget.onrender.com'],
    proxy: {
      '/api': 'http://127.0.0.1:8080',
    },
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: ['kestralbudget.onrender.com']
  }
})