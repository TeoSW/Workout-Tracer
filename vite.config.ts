import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { APP_NAME, APP_SHORT_NAME } from './src/domain/config';

/** Must match the GitHub Pages repo path. */
const BASE_PATH = '/workout-tracker/';

/** Keeps src/domain/config the one place for the name, index.html included. */
function appNameInHtml(): Plugin {
  return {
    name: 'app-name-in-html',
    transformIndexHtml: (html) =>
      html.replaceAll('__APP_NAME__', APP_NAME).replaceAll('__APP_SHORT_NAME__', APP_SHORT_NAME),
  };
}

export default defineConfig({
  plugins: [
    react(),
    appNameInHtml(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html}'],
        // Without this the first launch has no worker in control, and lazy chunks need the network.
        clientsClaim: true,
        // The main chunk is close to Workbox's 2 MiB default, and it has to be in the precache.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        id: BASE_PATH,
        name: APP_NAME,
        short_name: APP_SHORT_NAME,
        description: 'A workout logger for iPhone.',
        lang: 'en',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#f2f2f7',
        background_color: '#f2f2f7',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  base: BASE_PATH,
});
