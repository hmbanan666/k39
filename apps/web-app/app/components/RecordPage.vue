<template>
  <ArticleShell
    :h1="page.doc.h1"
    :crumbs="page.doc.crumbs"
  >
    <div v-html="page.html" />
    <LinkList
      :title="listTitle"
      :links="page.items"
    />
  </ArticleShell>
</template>

<script setup lang="ts">
import type { SeoDocument } from '~~/shared/seo'

defineProps<{ page: { doc: SeoDocument, html: string, items: { href: string, text: string }[] }, listTitle: string }>()
</script>
