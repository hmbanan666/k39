<template>
  <RecordPage
    :page="page"
    list-title="Точки квеста"
    kicker="Квест"
  />
</template>

<script setup lang="ts">
import type { SeoDocument } from '~~/shared/seo'

const slug = String(useRoute().params.slug || '')
const page = await fetchPublic<{ doc: SeoDocument, html: string, items: { href: string, text: string }[] }>(`/api/public/quests/${slug}`)
usePublicHead(page.doc)
</script>
