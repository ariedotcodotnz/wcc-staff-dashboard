import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // This can be useful for development to avoid CORS issues
    // if you have a separate backend API.
    proxy: {
      '/data': {
        target: 'http://localhost:3000', // Assuming a local server serves the data
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/data/, ''),
      },
    },
  },
  build: {
    // You can add build-specific options here if needed.
  },
});