import { defineConfig } from 'vite'

export default defineConfig({
  define: {
    'process.env.VITE_API_URL': JSON.stringify('https://threedsocbackend.onrender.com/api'),
    'process.env.VITE_WS_URL': JSON.stringify('wss://threedsocbackend.onrender.com'),
  },
  build: {
    // Ensure that Vite uses the environment variables from Render
    // This will replace import.meta.env.VITE_API_URL and VITE_WS_URL during build
    rollupOptions: {
      output: {
        // Example: If you need to make sure certain global variables are set
        // globals: {'process.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL)}
      }
    }
  }
}) 