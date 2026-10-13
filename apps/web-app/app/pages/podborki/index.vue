<template>
  <ArticleShell
    :h1="page.doc.h1"
    :crumbs="page.doc.crumbs"
  >
    <LinkList
      title="По месяцам"
      :links="page.months"
    />
    <LinkList
      title="Все подборки"
      :links="page.items"
    />
  </ArticleShell>
</template>

<script setup lang="ts">
import type { SeoDocument } from '~~/shared/seo'

const page = await fetchPublic<{ doc: SeoDocument, items: { href: string, text: string }[], months: { href: string, text: string }[] }>('/api/public/collections')
usePublicHead(page.doc)
</script>
