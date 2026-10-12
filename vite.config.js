import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const contentSecurityPolicy = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'"

const productionCsp = {
  name: 'umbra-production-csp',
  apply: 'build',
  transformIndexHtml(html) {
    const meta = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}"/>`
    return html.replace('</head>', `${meta}</head>`)
  },
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Umbra', short_name: 'Umbra', description: 'Convert anything. Leave no trace.',
        theme_color: '#050506', background_color: '#050506', display: 'standalone',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,wasm}'], maximumFileSizeToCacheInBytes: 12 * 1024 * 1024, navigateFallback: '/index.html' },
    }),
    productionCsp,
  ],
  worker: { format: 'es' },
  esbuild: { target: 'esnext' },
  build: { target: 'esnext' },
  optimizeDeps: {
    exclude: [
      '@jsquash/jpeg', '@jsquash/png', '@jsquash/webp', '@jsquash/avif', '@jsquash/jxl', '@jsquash/oxipng',
      'libheif-js', '@pbk20191/icodec', '@imagemagick/magick-wasm', 'utif', 'pdfjs-dist',
    ],
    esbuildOptions: { target: 'esnext' },
  },
  server: { headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'credentialless' } },
})
