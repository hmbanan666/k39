import { DEFAULT_BASEMAP_FILE, DEFAULT_BASEMAP_SHA256, DEFAULT_BASEMAP_SOURCE_URL } from './server/utils/basemap-defaults'
import { tablerIconList } from './shared/icons'
import { brandHeadLinks } from './shared/seo'

export default defineNuxtConfig({
  // Opt out in config so `nuxt dev` does not wait on the telemetry prompt.
  telemetry: false,
  devServer: {
    // 0.0.0.0 answers 127.0.0.1. The default host is localhost, which binds ::1 only.
    host: '0.0.0.0',
    port: 3000,
  },
  css: ['~/assets/css/tokens.css', '~/assets/css/base.css', '~/assets/css/styles.css'],
  site: {
    url: 'https://k39.online',
    name: 'K39',
    description: 'Места Калининградской области: форты, замки, пляжи, маршруты и квесты.',
    defaultLocale: 'ru',
  },
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      titleTemplate: '%s',
      meta: [
        // Brick token --color-brick, same value as site.webmanifest theme_color.
        { name: 'theme-color', content: '#a3402a' },
      ],
      link: [...brandHeadLinks],
    },
  },
  fonts: {
    provider: 'google',
    defaults: {
      subsets: ['cyrillic', 'latin'],
      styles: ['normal'],
      weights: [400],
      preload: true,
    },
    families: [
      { name: 'Alegreya', provider: 'google', weights: [400, 700], styles: ['normal', 'italic'], display: 'swap', preload: true },
      { name: 'Alegreya SC', provider: 'google', weights: [400], styles: ['normal'], display: 'swap', preload: true },
      { name: 'Golos Text', provider: 'google', weights: [400, 700], styles: ['normal'], display: 'swap', preload: true },
    ],
  },
  sitemap: {
    sources: ['/sitemap-urls'],
    exclude: ['/admin/**', '/api/**', '/sign-in', '/map/**', '/preview/**', '/sitemap-urls'],
  },
  robots: {
    credits: false,
    metaTag: false,
    header: false,
    // The module rewrites robots.txt and drops the Yandex Host line. Serve the file as-is.
    robotsTxt: false,
    mergeWithRobotsTxtPath: false,
  },
  routeRules: {
    '/sitemap-urls': { headers: { 'x-robots-tag': 'noindex' } },
    '/legal/privacy-policy': { redirect: { to: '/privacy', statusCode: 301 } },
    '/cookies': { redirect: { to: '/privacy#cookies', statusCode: 301 } },
    // Legacy URLs from the old site that still get search impressions.
    '/lastochka': { redirect: { to: '/eda', statusCode: 301 } },
    '/lastochka/**': { redirect: { to: '/eda', statusCode: 301 } },
    // Old cafe pages.
    '/pages': { redirect: { to: '/eda', statusCode: 301 } },
    '/pages/**': { redirect: { to: '/eda', statusCode: 301 } },
    '/media/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    '/fonts/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    // Brand URLs stay stable, so they are not immutable. A week lets a deploy replace them.
    // The manifest is a day so a theme or icon change is not stuck behind the image cache.
    ...Object.fromEntries([
      '/favicon.ico',
      '/favicon-16.png',
      '/favicon-32.png',
      '/apple-touch-icon.png',
      '/icon-192.png',
      '/icon-512.png',
      '/icon-maskable-512.png',
      '/logo/**',
      '/og-default.jpg',
      '/og-default.png',
    ].map((path) => [path, { headers: { 'cache-control': 'public, max-age=604800' } }])),
    '/site.webmanifest': { headers: { 'cache-control': 'public, max-age=86400' } },
    '/basemap/fonts/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    '/basemap/sprites/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
  },
  runtimeConfig: {
    // NUXT_BASEMAP_FILE. The archive stays on a volume. Boot downloads it when the hash does not match.
    basemapFile: DEFAULT_BASEMAP_FILE,
    // NUXT_BASEMAP_SOURCE_URL and BASEMAP_SOURCE_URL. Baked so Dokploy needs no new variable.
    basemapSourceUrl: DEFAULT_BASEMAP_SOURCE_URL,
    // NUXT_BASEMAP_SHA256 and BASEMAP_SHA256. The map uses the file only when this matches.
    basemapSha256: DEFAULT_BASEMAP_SHA256,
    public: {
      featureMap: false,
      consentBanner: false,
      yandexVerification: '',
      googleVerification: '',
      // Kept so an existing deploy env does not fail validation. ADR 0019 does not load Yandex Maps.
      yandexMapsApiKey: '',
      // Optional https object-storage override. A path is ignored. The same-origin URL is chosen at runtime.
      pmtilesUrl: '',
    },
  },
  nitro: {
    compressPublicAssets: true,
    experimental: {
      asyncContext: true,
    },
    externals: {
      external: ['sharp'],
      // A second @iconify/utils under @nuxt/icon was externalized to
      // /@nuxt/icon/node_modules/@iconify/utils/..., which the image does not contain.
      inline: ['@iconify/utils', '@iconify/vue'],
    },
  },
  mcp: {
    name: 'K39 content',
    route: '/mcp',
  },
  modules: [
    'nuxt-auth-utils',
    '@nuxtjs/seo',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@vueuse/nuxt',
    '@nuxtjs/mcp-toolkit',
  ],
  icon: {
    mode: 'svg',
    serverBundle: 'local',
    clientBundle: {
      scan: true,
      icons: tablerIconList(),
    },
    fallbackToApi: false,
  },
  experimental: {
    typedPages: false,
  },
  compatibilityDate: '2025-10-31',
})
