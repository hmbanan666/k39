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
      <template
        v-if="page.admission.stored || page.admission.extrasStored"
        #lead
      >
        <FactsCard>
          <TicketsFact :admission="page.admission" />
        </FactsCard>
      </template>
      <!-- In the article column, so the sticky contents rail reaches it. -->
      <template #after>
        <UpcomingEvents
          :id="PAGE_SECTIONS.upcoming.id"
          :items="page.upcoming"
          :title="PAGE_SECTIONS.upcoming.title"
        />
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
import type { AdmissionView } from '~~/shared/admission'
import type { EventLine } from '~~/shared/events'
import type { NoticeWindow } from '~~/shared/notices'
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
  admission: AdmissionView
  upcoming: EventLine[]
  eatNearby: Array<{
    href: string
    slug: string
    name: string
    kindLabel: string
    distance: string
    partner: boolean
    stale: boolean
    schedule: ScheduleRecord | null
    notices?: NoticeWindow[]
  }>
}>(`/api/public/routes/${slug}`)
usePublicHead(page.doc)
const sectionsBefore = presentSections([[PAGE_SECTIONS.stops, page.stops.length > 0]])
const sectionsAfter = presentSections([
  [PAGE_SECTIONS.upcoming, page.upcoming.length > 0],
  [PAGE_SECTIONS.eatNearby, (page.eatNearby?.length ?? 0) > 0],
])
</script>
