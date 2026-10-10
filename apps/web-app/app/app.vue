<template>
  <UApp :locale="ru">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ConsentBanner />
  </UApp>
</template>

<script setup lang="ts">
import { ru } from '@nuxt/ui/locale'

const config = useRuntimeConfig()
const meta = [
  config.public.yandexVerification ? { name: 'yandex-verification', content: String(config.public.yandexVerification) } : null,
  config.public.googleVerification ? { name: 'google-site-verification', content: String(config.public.googleVerification) } : null,
].filter((item) => item !== null)

useHead({
  htmlAttrs: { lang: 'ru' },
  meta,
})
</script>
