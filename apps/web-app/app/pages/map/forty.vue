<template>
  <MapFortsMap />
</template>

<script setup lang="ts">
definePageMeta({ layout: 'map' })

const flags = await $fetch('/api/public/flags')
if (!flags.map) {
  throw createError({ statusCode: 404, statusMessage: 'Страница не найдена', fatal: true })
}
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>
