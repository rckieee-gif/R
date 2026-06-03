/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function manualChunks(id) {
  const normalizedId = id.replace(/\\/g, '/')

  if (!normalizedId.includes('/node_modules/')) return undefined

  if (
    normalizedId.includes('/node_modules/react/') ||
    normalizedId.includes('/node_modules/react-dom/') ||
    normalizedId.includes('/node_modules/react-router/') ||
    normalizedId.includes('/node_modules/react-router-dom/')
  ) {
    return 'vendor-react'
  }

  if (
    normalizedId.includes('/node_modules/recharts/') ||
    normalizedId.includes('/node_modules/d3-') ||
    normalizedId.includes('/node_modules/victory-vendor/')
  ) {
    return 'vendor-charts'
  }

  return 'vendor'
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/__tests__/**/*.test.{js,jsx}'],
  }
})
