import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron', 'electron-log', 'better-sqlite3-multiple-ciphers', 'keytar', 'libsodium-wrappers', 'libsodium-wrappers-sumo'],
    },
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
});