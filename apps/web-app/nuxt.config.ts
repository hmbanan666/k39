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
    '/media/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    '/fonts/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
  },
  runtimeConfig: {
    public: {
      featureMap: false,
      yandexVerification: '',
      googleVerification: '',
    },
  },
  nitro: {
    compressPublicAssets: true,
  },
  modules: [
    'nuxt-auth-utils',
    '@nuxtjs/seo',
    '@nuxt/fonts',
    '@vueuse/nuxt',
  ],
  experimental: {
    typedPages: false,
  },
  compatibilityDate: '2025-10-31',
})
