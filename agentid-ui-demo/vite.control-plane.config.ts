import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
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
  base: './',
  build: {
      rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'index.html'),
        controlPlane: path.resolve(__dirname, 'control-plane.html'),
        login: path.resolve(__dirname, 'login.html'),
        device: path.resolve(__dirname, 'device.html'),
        agentPublic: path.resolve(__dirname, 'agent-public.html'),
      },
    },
  },
})
