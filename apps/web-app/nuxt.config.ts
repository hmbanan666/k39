import { brandHeadLinks } from './shared/seo'

export default defineNuxtConfig({
  devServer: {
    port: 3000,
  },
  css: ['~/assets/css/tokens.css', '~/assets/css/base.css', '~/assets/css/styles.css', '~/assets/css/forts-map.css'],
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
    // NUXT_BASEMAP_FILE. The PMTiles archive stays on a volume, not in the image.
    basemapFile: '/app/basemap/kaliningrad.pmtiles',
    public: {
      featureMap: false,
      consentBanner: false,
      yandexVerification: '',
      googleVerification: '',
      // Kept so an existing deploy env does not fail validation. ADR 0019 does not load Yandex Maps.
      yandexMapsApiKey: '',
      // Empty keeps the OpenFreeMap fallback. A path or https URL loads the self-hosted archive.
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
    '@vueuse/nuxt',
    '@nuxtjs/mcp-toolkit',
  ],
  experimental: {
    typedPages: false,
  },
  compatibilityDate: '2025-10-31',
})
