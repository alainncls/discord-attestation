import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('vite/preload-helper')) {
            return 'preload-helper';
          }

          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }

          // Keep wallet packages that share viem internals in stable chunks.
          if (
            id.includes('/node_modules/viem/') ||
            id.includes('/node_modules/ox/') ||
            id.includes('/node_modules/abitype/') ||
            id.includes('/node_modules/@noble/')
          ) {
            return 'wallet-core';
          }

          if (
            id.includes('/node_modules/@reown/') ||
            id.includes('/node_modules/@walletconnect/') ||
            id.includes('/node_modules/@wagmi/') ||
            id.includes('/node_modules/wagmi/') ||
            id.includes('/node_modules/valtio/')
          ) {
            return 'wallet-ui';
          }
        },
      },
    },
  },
});
