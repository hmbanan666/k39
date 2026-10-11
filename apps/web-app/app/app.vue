<template>
  <TooltipProvider :delay-duration="280">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ConsentBanner />
  </TooltipProvider>
</template>

<script setup lang="ts">
import { TooltipProvider } from 'reka-ui'
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
