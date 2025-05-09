import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Add any aliases your project might need
    }
  },
  build: {
    rollupOptions: {
      input: {
        renderer: 'index.html'
      }
    }
  }
});
