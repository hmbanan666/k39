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

useHead({
  htmlAttrs: { lang: 'ru' },
})
</script>
