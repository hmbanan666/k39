<template>
  <TooltipProvider :delay-duration="280">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ConsentBanner />
    <noscript>
      <img
      src="/api/collect.gif"
      alt=""
      width="1"
      height="1"
      style="position:absolute;width:1px;height:1px;overflow:hidden"
      >
    </noscript>
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
  script: [{ src: '/collect.js', defer: true, tagPosition: 'bodyClose' }],
})
</script>
