<template>
  <ArticleShell
    :h1="page.doc.h1"
    :crumbs="page.doc.crumbs"
  >
    <LinkList
      title="Все маршруты"
      :links="page.items"
    />
  </ArticleShell>
</template>

<script setup lang="ts">
import type { SeoDocument } from '~~/shared/seo'

const page = await fetchPublic<{ doc: SeoDocument, items: { href: string, text: string }[] }>('/api/public/routes')
usePublicHead(page.doc)
</script>
