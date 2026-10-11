<template>
  <RecordPage
    :page="page"
    list-title="Остановки"
    kicker="Маршрут"
  />
</template>

<script setup lang="ts">
import type { SeoDocument } from '~~/shared/seo'

const slug = String(useRoute().params.slug || '')
const page = await fetchPublic<{ doc: SeoDocument, html: string, items: { href: string, text: string }[] }>(`/api/public/routes/${slug}`)
usePublicHead(page.doc)
</script>
