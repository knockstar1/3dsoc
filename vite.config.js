import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    // Ensure that Vite uses the environment variables from Render
    // This will replace import.meta.env.VITE_API_URL and VITE_WS_URL during build
    rollupOptions: {
      output: {
        // Example: If you need to make sure certain global variables are set
        // globals: {'process.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL)}
      }
    }
  },
  // Define process.env variables for client-side to use in build
  // This ensures that Vite picks up the environment variables from Render's build environment
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL),
    'import.meta.env.VITE_WS_URL': JSON.stringify(process.env.VITE_WS_URL)
  }
}) 