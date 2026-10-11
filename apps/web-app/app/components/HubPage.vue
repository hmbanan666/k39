<template>
  <ArticleShell
    :h1="page.doc.h1"
    :crumbs="page.doc.crumbs"
    kicker="Раздел"
  >
    <div
      class="prose"
      v-html="page.html"
    />
    <h2>Места</h2>
    <div class="card-grid">
      <PlaceCard
        v-for="place in page.places"
        :key="place.href"
        :href="place.href"
        :title="place.title"
        :summary="place.summary"
        :hub="place.hub"
        :hub-href="place.hubHref"
      />
    </div>
    <LinkList
      title="Маршруты"
      :links="page.routes"
    />
  </ArticleShell>
</template>

<script setup lang="ts">
import type { SeoDocument } from '~~/shared/seo'

const props = defineProps<{ slug: string }>()
const page = await fetchPublic<{
  doc: SeoDocument
  html: string
  places: Array<{ href: string, title: string, summary: string, hub: string, hubHref: string }>
  routes: { href: string, text: string }[]
}>(`/api/public/hubs/${props.slug}`)
usePublicHead(page.doc)
</script>
