<template>
  <main class="legal">
    <ContentRenderer
      v-if="page"
      :value="page"
    />
  </main>
</template>

<script setup lang="ts">
const { data: page } = await useAsyncData('privacy', () =>
  queryCollection('legal').path('/legal/privacy-policy').first(),
)

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Страница не найдена', fatal: true })
}

useSeoMeta({ title: 'Политика конфиденциальности' })
</script>

<style scoped>
.legal { max-width: 42rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
</style>
