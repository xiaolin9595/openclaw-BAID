import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

function deviceApprovalRoute(): Plugin {
  return {
    name: 'agentid-device-approval-route',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.url?.match(/^\/device(?:\?|$)/)) {
          request.url = request.url.replace(/^\/device(?=\?|$)/, '/control-plane.html')
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), deviceApprovalRoute()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@store': path.resolve(__dirname, './src/store'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
  base: './', // 支持相对路径
})
