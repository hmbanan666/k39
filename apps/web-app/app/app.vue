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
import { verificationMeta } from '~~/shared/seo'

const config = useRuntimeConfig()
const meta = verificationMeta(
  String(config.public.yandexVerification || ''),
  String(config.public.googleVerification || ''),
)

useHead({
  htmlAttrs: { lang: 'ru' },
  meta,
})
</script>
