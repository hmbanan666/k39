<template>
  <ArticleShell
    :h1="page.doc.h1"
    :crumbs="page.doc.crumbs"
  >
    <p>Черновик. Эту страницу нельзя индексировать.</p>
    <ProseHtml :html="page.html" />
  </ArticleShell>
</template>

<script setup lang="ts">
import type { SeoDocument } from '~~/shared/seo'

definePageMeta({ layout: 'admin', middleware: ['admin-only'] })

const slug = String(useRoute().params.slug || '')
const page = await fetchPublic<{ doc: SeoDocument, html: string }>(`/api/admin/preview/${slug}`)
usePublicHead(page.doc)
</script>
