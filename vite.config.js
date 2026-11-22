import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { supportPages } from './src/supportPages.js'
import { errorEntries } from './src/errors/catalog.js'

const pages = { privacy: 'privacy-policy', licenses: 'licenses', help: 'help' }
const documentSections = {
  privacy: [
    ['On-device conversion', 0, 1],
    ['File storage', 1, 2],
    ['Offline use', 2, 3],
  ],
  licenses: [
    ['libheif and libde265', 0, 1],
    ['x265 and HEVC', 1, 3],
    ['icodec and other dependencies', 3, 4],
  ],
}
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char])

const supportHtml = {
  name: 'umbra-support-html',
  transformIndexHtml(html) {
    return html.replace(/<!-- support:(privacy|licenses|help) -->/, (_, route) => {
      const { title, intro, body } = supportPages[pages[route]]
      const sections = documentSections[route]
      const content = sections?.map(([heading, start, end], index) => `
        <section class="support-section" id="topic-${index + 1}">
          <h2>${escapeHtml(heading)}</h2>
          ${body.slice(start, end).map(line => `<p>${escapeHtml(line)}</p>`).join('')}
        </section>`).join('') ?? ''
      const documentContent = sections ? `
        <div class="support-document-grid">
          <nav class="support-contents" aria-label="On this page">
            <p>On this page</p>
            <ul>${sections.map(([heading], index) => `<li><a href="#topic-${index + 1}">${escapeHtml(heading)}</a></li>`).join('')}</ul>
          </nav>
          <div class="support-article">${content}</div>
        </div>` : ''
      const help = route === 'help' ? `
        <div class="help-search" role="search" aria-label="UMBRA error codes" hidden>
          <label for="error-search">Search error codes</label>
          <input type="search" id="error-search" placeholder="Try UMB-1001 or unsupported format" autocomplete="off" />
        </div>
        <p id="error-empty" role="status" hidden>No matching error codes.</p>
        <div class="error-results">${errorEntries.map(item => `
          <article><div><b>${escapeHtml(item.id)}</b><strong>${escapeHtml(item.title)}</strong></div>
            <p>${escapeHtml(item.message)}</p><small>${escapeHtml(item.fix)}</small></article>`).join('')}
        </div>` : ''
      const links = Object.entries({ privacy: 'Privacy', licenses: 'Licenses', help: 'Help' })
        .map(([path, label]) => `<a href="/${path}/"${path === route ? ' aria-current="page"' : ''}>${label}</a>`).join('')
      return `
        <header class="site-nav${sections ? ' support-nav' : ''}"><a class="logo-link${sections ? ' umbra-logo' : ''}" href="/"><img src="/favicon.svg" width="32" height="32" alt="" /> <span${sections ? ' class="umbra-wordmark"' : ''}>UMBRA</span></a></header>
        <main class="converter-section support-page${sections ? ' support-document' : ''}">
          <a class="support-back" href="/">${sections ? '<span aria-hidden="true">←</span> ' : ''}Back to converter</a>
          <div class="${sections ? 'support-hero' : ''}">
            <h1>${escapeHtml(title)}</h1>
            <p class="drawer-intro">${escapeHtml(intro)}</p>
          </div>
          ${documentContent || help}
        </main>
        <footer class="site-footer${sections ? ' support-footer' : ''}"><nav class="footer-links" aria-label="Support">${links}</nav></footer>`
    })
  },
}

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
    supportHtml,
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
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,wasm}'], maximumFileSizeToCacheInBytes: 12 * 1024 * 1024, navigateFallback: '/index.html', navigateFallbackAllowlist: [/^\/(?:\?.*)?$/] },
    }),
    productionCsp,
  ],
  worker: { format: 'es' },
  esbuild: { target: 'esnext' },
  build: {
    target: 'esnext',
    rollupOptions: { input: ['index.html', ...Object.keys(pages).map(path => `${path}/index.html`)] },
  },
  optimizeDeps: {
    exclude: [
      '@jsquash/jpeg', '@jsquash/png', '@jsquash/webp', '@jsquash/avif', '@jsquash/jxl', '@jsquash/oxipng',
      'libheif-js', '@pbk20191/icodec', '@imagemagick/magick-wasm', 'utif', 'pdfjs-dist',
    ],
    esbuildOptions: { target: 'esnext' },
  },
  server: { headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'credentialless' } },
})
