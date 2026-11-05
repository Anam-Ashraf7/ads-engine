import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

declare const process: { env: Record<string, string | undefined> }; // no @types/node in this project

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.AE_WEB_PORT || 5180),
    strictPort: true,
    // PROTOTYPE: the Google Ads server (server/gads-server.mjs). Only used by the API check page and the live card.
    proxy: { '^/api/': `http://127.0.0.1:${process.env.AE_API_PORT || 5190}` }, // AE_API_PORT: point a second copy at another server
  },
});
