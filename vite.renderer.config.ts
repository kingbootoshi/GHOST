import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config
export default defineConfig(async () => {
  // Dynamically import the Tailwind plugin at runtime
  const { default: tailwindcss } = await import('@tailwindcss/vite');

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
  } satisfies import('vite').UserConfig;
});