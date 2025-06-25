import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        character: resolve(__dirname, 'character.html'),
        messages: resolve(__dirname, 'messages.html'),
        notifications: resolve(__dirname, 'notifications.html')
      }
    }
  },
  server: {
    port: 3000
  }
}) 