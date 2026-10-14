<template>
  <ArticleShell
    :h1="page.doc.h1"
    :crumbs="page.doc.crumbs"
    kicker="Маршрут"
    :lede="page.summary"
  >
    <RouteGuide
      :id="PAGE_SECTIONS.stops.id"
      :stops="page.stops"
      :path="page.path"
      :focus-href="`/marshruty/${slug}`"
    />
    <ReaderLayout
      :html="page.html"
      :sections-before="sectionsBefore"
      :sections-after="sectionsAfter"
    >
      <!-- In the article column, so the sticky contents rail reaches it. -->
      <template #after>
        <VenueNearby
          :id="PAGE_SECTIONS.eatNearby.id"
          :items="page.eatNearby || []"
          :title="PAGE_SECTIONS.eatNearby.title"
        />
      </template>
    </ReaderLayout>
  </ArticleShell>
</template>

<script setup lang="ts">
import type { RouteStopView } from '~~/shared/route-nav'
import type { ScheduleRecord } from '~~/shared/schedule'
import type { SeoDocument } from '~~/shared/seo'
import { PAGE_SECTIONS, presentSections } from '~~/shared/page-sections'

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
    schedule: ScheduleRecord | null
  }>
}>(`/api/public/routes/${slug}`)
usePublicHead(page.doc)
const sectionsBefore = presentSections([[PAGE_SECTIONS.stops, page.stops.length > 0]])
const sectionsAfter = presentSections([[PAGE_SECTIONS.eatNearby, (page.eatNearby?.length ?? 0) > 0]])
</script>
