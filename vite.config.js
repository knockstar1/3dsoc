import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        character: resolve(process.cwd(), 'character.html'),
        messages: resolve(process.cwd(), 'messages.html'),
        notifications: resolve(process.cwd(), 'notifications.html')
      }
    }
  }
}) 