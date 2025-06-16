import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig(async () => {
  // Dynamically import ESM-only plugin to avoid `require()` issues when Vite
  // loads this config via ts-node in a CommonJS context.
  const { viteStaticCopy } = await import('vite-plugin-static-copy');

  return {
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: 'src/modules/**',
            dest: 'modules',
          },
        ],
      }),
    ],
    build: {
      rollupOptions: {
        external: [
          'electron',
          'electron-log',
          'better-sqlite3-multiple-ciphers',
          'keytar',
          'libsodium-wrappers',
          'libsodium-wrappers-sumo',
        ],
      },
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
  };
});