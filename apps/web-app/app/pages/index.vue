<template>
  <ArticleShell
    :h1="page.doc.h1"
    :crumbs="page.doc.crumbs"
  >
    <p>Форты, замки, пляжи, курорты, музеи и еда. У каждого места свой адрес, статус и источник.</p>
    <LinkList
      title="Разделы"
      :links="hubs"
    />
    <LinkList
      title="С чего начать"
      :links="page.featured"
    />
  </ArticleShell>
</template>

<script setup lang="ts">
import type { SeoDocument } from '~~/shared/seo'
import { HUBS, SECTION_LINKS } from '~~/shared/links'

const page = await fetchPublic<{ doc: SeoDocument, featured: { href: string, text: string }[] }>('/api/public/home')
const hubs = [...HUBS, ...SECTION_LINKS]
usePublicHead(page.doc)
onMounted(() => useTrack().track('page_view'))
</script>
