<template>
  <ArticleShell
    :h1="page.doc.h1"
    :crumbs="page.doc.crumbs"
    :kicker="kicker"
  >
    <div
      class="prose"
      v-html="page.html"
    />
    <RouteSteps
      :title="listTitle"
      :steps="page.items"
    />
  </ArticleShell>
</template>

<script setup lang="ts">
import type { SeoDocument } from '~~/shared/seo'

defineProps<{
  page: { doc: SeoDocument, html: string, items: { href: string, text: string, note?: string | null }[] }
  listTitle: string
  kicker?: string
}>()
</script>
