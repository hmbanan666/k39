<template>
  <ArticleShell
    :h1="page.doc.h1"
    :crumbs="page.doc.crumbs"
    kicker="Маршрут"
    :lede="page.summary"
  >
    <RouteGuide
      :stops="page.stops"
      :path="page.path"
      :focus-href="`/marshruty/${slug}`"
    />
    <ReaderLayout :html="page.html" />
    <VenueNearby :items="page.eatNearby || []" />
  </ArticleShell>
</template>

<script setup lang="ts">
import type { RouteStopView } from '~~/shared/route-nav'
import type { SeoDocument } from '~~/shared/seo'

const slug = String(useRoute().params.slug || '')
const page = await fetchPublic<{
  doc: SeoDocument
  html: string
  summary: string
  path: [number, number][] | null
  stops: RouteStopView[]
  eatNearby: Array<{
    href: string
    slug: string
    name: string
    kindLabel: string
    distance: string
    partner: boolean
    stale: boolean
  }>
}>(`/api/public/routes/${slug}`)
usePublicHead(page.doc)
</script>
