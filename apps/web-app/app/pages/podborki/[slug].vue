<template>
  <ArticleShell
    :h1="page.doc.h1"
    :crumbs="page.doc.crumbs"
    kicker="Подборка"
  >
    <div
      class="prose"
      v-html="page.html"
    />
    <MapEmbed
      v-if="page.items[0]"
      label="Карта подборки"
      :focus-href="page.items[0].href"
      :hrefs="page.items.map((item) => item.href)"
    />
    <RouteSteps
      title="Места подборки"
      :steps="page.items"
    />
  </ArticleShell>
</template>

<script setup lang="ts">
import type { SeoDocument } from '~~/shared/seo'

const slug = String(useRoute().params.slug || '')
const page = await fetchPublic<{ doc: SeoDocument, html: string, items: { href: string, text: string }[] }>(`/api/public/collections/${slug}`)
usePublicHead(page.doc)
</script>
