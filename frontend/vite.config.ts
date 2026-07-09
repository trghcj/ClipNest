import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'Clipnest_Logo.png'],
      manifest: {
        name: 'ClipNest',
        short_name: 'ClipNest',
        description: 'An intelligent, full-stack bookmark management platform',
        theme_color: '#F8F6F1',
        background_color: '#F8F6F1',
        display: 'standalone',
        icons: [
          {
            src: 'Clipnest_Logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'Clipnest_Logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
