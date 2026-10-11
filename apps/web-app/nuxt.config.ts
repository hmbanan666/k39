export default defineNuxtConfig({
  devServer: {
    port: 3000,
  },
  css: ['~/assets/css/styles.css', '~/assets/css/forts-map.css'],
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
  ui: {
    colorMode: false,
    fonts: false,
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
    '@nuxt/ui',
    '@vueuse/nuxt',
  ],
  experimental: {
    typedPages: false,
  },
  compatibilityDate: '2025-10-31',
})
