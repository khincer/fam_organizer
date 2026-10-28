import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [vue(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['favicon.svg'],
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'sw.js',
    manifest: {
      name: 'Casa en orden', short_name: 'En orden', description: 'La agenda compartida de tu familia',
      theme_color: '#f7f5ef', background_color: '#f7f5ef', display: 'standalone',
      start_url: '/', scope: '/', lang: 'es',
      icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
    }
  })]
})
