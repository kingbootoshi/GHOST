import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['keytar', 'better-sqlite3', 'libsodium-wrappers-sumo']
    }
  }
});
