<template>
  <ArticleShell
    :h1="page.doc.h1"
    :crumbs="page.doc.crumbs"
  >
    <div v-html="page.html" />
    <LinkList
      title="Места"
      :links="page.places"
    />
    <LinkList
      title="Маршруты"
      :links="page.routes"
    />
  </ArticleShell>
</template>

<script setup lang="ts">
import type { SeoDocument } from '~~/shared/seo'

const props = defineProps<{ slug: string }>()
const page = await fetchPublic<{ doc: SeoDocument, html: string, places: { href: string, text: string }[], routes: { href: string, text: string }[] }>(`/api/public/hubs/${props.slug}`)
usePublicHead(page.doc)
</script>
