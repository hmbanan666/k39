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
      titleTemplate: '%s | K39',
    },
  },
  ui: {
    colorMode: false,
    fonts: false,
  },
  sitemap: {
    exclude: ['/sign-in', '/api/**'],
    sources: ['/api/__sitemap__/urls'],
  },
  runtimeConfig: {
    oauth: {
      yandex: {
        clientId: '',
        clientSecret: '',
      },
      vk: {
        clientId: '',
        clientSecret: '',
      },
    },
  },
  modules: [
    'nuxt-auth-utils',
    '@nuxtjs/seo',
    '@nuxt/ui',
    '@nuxt/content',
    '@vueuse/nuxt',
  ],
  content: {
    experimental: { nativeSqlite: true },
  },
  experimental: {
    typedPages: true,
  },
  compatibilityDate: '2025-10-31',
})
