<template>
  <ArticleShell
    :h1="page.doc.h1"
    :crumbs="page.doc.crumbs"
    kicker="Раздел"
  >
    <div
      v-if="articleHtml"
      class="prose"
      v-html="articleHtml"
    />
    <h2>Места</h2>
    <div class="card-grid">
      <PlaceCard
        v-for="place in page.places"
        :key="place.href"
        :href="place.href"
        :title="place.title"
        :summary="place.summary"
        :kind="place.kind"
        :media="place.media"
        :image="place.image"
      />
    </div>
    <LinkList
      title="Маршруты"
      :links="page.routes"
    />
  </ArticleShell>
</template>

<script setup lang="ts">
import type { PublicMedia } from '~~/shared/media'
import type { SeoDocument } from '~~/shared/seo'

const props = defineProps<{ slug: string }>()
const page = await fetchPublic<{
  doc: SeoDocument
  html: string
  bodyHtml: string
  places: Array<{ href: string, title: string, summary: string, hub: string, hubHref: string, kind: string, media: PublicMedia | null, image: { src: string, alt: string, width: number | null, height: number | null } | null }>
  routes: { href: string, text: string }[]
}>(`/api/public/hubs/${props.slug}`)
const articleHtml = `${page.html}${page.bodyHtml}`
usePublicHead(page.doc)
</script>
