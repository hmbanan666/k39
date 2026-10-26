<template>
  <article class="page page-wide place">
    <UiBreadcrumbs :crumbs="page.doc.crumbs" />
    <!-- The category is named once in the breadcrumb and once in the kicker. -->
    <header class="hero">
      <Postcard
        class="hero-card"
        :src="heroSrc"
        :alt="heroAlt"
        :caption="page.doc.h1"
        tilt="-1.2deg"
        ratio="16 / 10"
        :stamp-src="illustrationFor(page.categorySlug, slug)"
        stamp-place="out"
        postmark
        priority
        :width="page.cover?.width || 1200"
        :height="page.cover?.height || 700"
      >
        <template
          v-if="page.cover"
          #art
        >
          <PlacePhoto
            :media="page.cover"
            priority
            :sizes="heroSizes"
            @open="openPhoto(page.cover.id)"
          />
        </template>
      </Postcard>
      <div class="hero-copy">
        <p class="kicker">
          {{ page.categoryTitle }}<template v-if="page.region"> · {{ regionLabel(page.region) }} </template>
        </p>
        <h1>{{ page.doc.h1 }}</h1>
        <p class="lede">
          {{ page.place.summary }}
        </p>
        <!-- No static «открыт» pill: it contradicted the live hours. A closed place
             says so here only when there is no verified schedule in «Коротко». -->
        <p
          v-if="closedNote"
          class="closed-note"
        >
          {{ closedNote }}
        </p>
        <TemporaryNotices
          :notices="page.notices"
          variant="hero"
        />
        <p class="actions">
          <DirectionsLink
            v-if="page.place.latitude != null && page.place.longitude != null"
            :latitude="page.place.latitude"
            :longitude="page.place.longitude"
            :entity="`/${slug}`"
          />
        </p>
      </div>
    </header>
    <div class="place-body">
      <ReaderLayout
        :html="page.html"
        :sections-after="sectionsAfter"
      >
        <template
          v-if="hasFacts || page.offers.length"
          #lead
        >
          <FactsCard
            v-if="hasFacts"
            :checked="checkedLabel"
          >
            <TemporaryNotices
              :notices="page.notices"
              variant="facts"
            />
            <OpeningLive
              hide-static-status
              :schedule="page.place.schedule"
              :notices="noticeWindows"
              :has-hours="Boolean(page.place.hours)"
            />
            <GuideFactRow
              v-for="row in facts"
              :key="row.key"
              :row="row"
            />
            <TicketsFact
              :admission="page.admission"
              :legacy-price="page.place.price"
            />
            <GuideFactRow
              v-if="address"
              :row="{ key: 'address', label: 'Адрес', value: address }"
            />
            <GuideFactRow
              v-for="row in contacts"
              :key="row.key"
              :row="row"
            />
            <!-- Coordinates stay in schema.org markup only. -->
            <MapOpenDialog
              v-if="hasCoords"
              :latitude="page.place.latitude!"
              :longitude="page.place.longitude!"
              :name="page.doc.h1"
              :address="address"
              :entity="`/${slug}`"
            />
          </FactsCard>
          <div
            v-if="page.offers.length"
            class="offers"
          >
            <PartnerOffer
              v-for="offer in page.offers"
              :key="offer.title"
              :title="offer.title"
              :terms="offer.terms"
            />
          </div>
        </template>
        <template #after>
          <UpcomingEvents
            :id="SECTIONS.upcoming.id"
            :items="page.upcoming"
            :title="SECTIONS.upcoming.title"
          />
          <section
            v-if="hasCoords || page.directionsHtml"
            :id="SECTIONS.directions.id"
            class="directions"
          >
            <h2 class="with-sticker">
              {{ SECTIONS.directions.title }}
              <Sticker
                slug="with-map"
                :width="72"
                decorative
              />
            </h2>
            <ProseHtml
              v-if="page.directionsHtml"
              class="directions-text"
              :html="page.directionsHtml"
            />
            <MapEmbed
              v-if="hasCoords"
              class="place-map"
              label="Карта места"
              :focus-href="`/${slug}`"
              :latitude="page.place.latitude!"
              :longitude="page.place.longitude!"
            />
          </section>
          <VenueNearby
            :id="SECTIONS.eatNearby.id"
            :items="page.eatNearby || []"
            :title="SECTIONS.eatNearby.title"
            :more-href="eatNowHref"
            more-text="Где поесть сейчас: все открытые заведения рядом →"
          />
          <section
            v-if="routes.length"
            :id="SECTIONS.placeRoutes.id"
            class="routes"
          >
            <h2>{{ SECTIONS.placeRoutes.title }}</h2>
            <ul>
              <li
                v-for="link in routes"
                :key="link.href"
              >
                <UiLink :href="link.href">
                  {{ link.text }}
                </UiLink>
              </li>
            </ul>
          </section>
          <section
            v-if="page.faq.length"
            :id="SECTIONS.faq.id"
            class="faq"
            aria-labelledby="faq-title"
          >
            <h2 id="faq-title">
              {{ SECTIONS.faq.title }}
            </h2>
            <details
              v-for="(item, index) in page.faq"
              :key="item.question"
              class="faq-item"
              :open="index === 0"
            >
              <summary>{{ item.question }}</summary>
              <p>{{ item.answer }}</p>
            </details>
          </section>
          <details
            v-if="page.sources.length"
            :id="SECTIONS.sources.id"
            class="sources"
          >
            <summary>{{ SECTIONS.sources.title }}</summary>
            <ul>
              <li
                v-for="source in page.sources"
                :key="source.url"
              >
                <UiLink
                  :href="source.url"
                  data-track="outbound"
                  data-track-name="source"
                >
                  {{ source.title }}
                </UiLink>
              </li>
            </ul>
            <p
              v-if="checkedLabel"
              class="sources-date"
            >
              Факты сверены с источниками {{ checkedLabel }}.
            </p>
          </details>
          <GuestBlock
            subject-type="place"
            :subject-slug="slug"
            :subject-path="`/${slug}`"
            :items="page.guests || []"
          />
        </template>
      </ReaderLayout>
    </div>
    <section
      v-if="nearby"
      :id="SECTIONS.nearby.id"
      class="nearby-block"
    >
      <h2>{{ SECTIONS.nearby.title }}</h2>
      <div class="nearby">
        <PlaceCard
          v-for="link in nearby.links"
          :key="link.href"
          :href="link.href"
          :title="link.text"
          :distance-km="link.distanceKm"
          :kind="link.kind || ''"
          :media="link.media"
        />
      </div>
    </section>
    <PhotoViewer
      v-if="photos.length"
      v-model:open="viewerOpen"
      v-model:index="viewerIndex"
      :photos="photos"
    />
  </article>
</template>

<script setup lang="ts">
import type { AdmissionView } from '~~/shared/admission'
import type { EventLine } from '~~/shared/events'
import type { GuestPublicItem } from '~~/shared/guest'
import type { PublicMedia } from '~~/shared/media'
import type { NoticeWindow, PublicNotice } from '~~/shared/notices'
import type { ScheduleRecord } from '~~/shared/schedule'
import type { SeoDocument } from '~~/shared/seo'
import { shortAddress } from '~~/shared/address'
import { eatNowPath } from '~~/shared/eat-now'
import { illustrationFor } from '~~/shared/illustrations'
import { lcpPreload } from '~~/shared/media'
import { statusWindows } from '~~/shared/notices'
import { PAGE_SECTIONS, presentSections } from '~~/shared/page-sections'
import { guideFacts, russianDay } from '~~/shared/place-guide'
import { regionLabel } from '~~/shared/region'
import { isVerified } from '~~/shared/schedule'

interface PlaceLink {
  href: string
  text: string
  distanceKm?: number | null
  kind?: string | null
  media?: PublicMedia | null
}
interface PlacePage {
  doc: SeoDocument
  html: string
  directionsHtml: string
  faq: Array<{ question: string; answer: string }>
  checkedAt: string | null
  place: {
    summary: string
    visitDuration: string | null
    bestTime: string | null
    status: string
    hours: string | null
    price: string | null
    phone: string | null
    website: string | null
    howToGet: string | null
    latitude: number | null
    longitude: number | null
    schedule: ScheduleRecord | null
  }
  admission: AdmissionView
  upcoming: EventLine[]
  categoryTitle: string
  categorySlug: string
  region: { slug: string; title: string; shortTitle?: string | null } | null
  images: Array<{ src: string; url: string; alt: string; width: number | null; height: number | null }>
  gallery: PublicMedia[]
  cover: PublicMedia | null
  groups: Array<{ title: string; links: PlaceLink[] }>
  notices: PublicNotice[]
  sources: Array<{ title: string; url: string }>
  guests?: GuestPublicItem[]
  offers: Array<{ title: string; terms: string }>

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
    regionSlug?: string | null
  }>
}

const route = useRoute()
const slug = String(route.params.slug || '')
const pageQuery = Number(route.query.page ?? 1)
const page = await fetchPublic<PlacePage>(`/api/public/places/${slug}`, {
  page: Number.isFinite(pageQuery) ? pageQuery : 1,
})
const heroSrc = page.cover?.src || illustrationFor(page.categorySlug, slug)
const heroAlt = page.cover?.alt || page.doc.h1
const photos =
  page.cover && !page.gallery.some((item) => item.id === page.cover?.id) ? [page.cover, ...page.gallery] : page.gallery
const viewerOpen = ref(false)
const viewerIndex = ref(0)
function openPhoto(id: string) {
  const found = photos.findIndex((item) => item.id === id)
  viewerIndex.value = found >= 0 ? found : 0
  viewerOpen.value = true
}
// A verified schedule already gives the live answer in «Коротко» (closed with
// a reason, by appointment, 24/7 outside). Only without one does the hero say
// the place is closed.
const closedByStatus = page.place.status === 'closed' && !isVerified(page.place.schedule)
const closedNote = closedByStatus ? 'Закрыто для посещения' : ''
// Contacts follow the address, so the block reads: visit facts, where, how to reach.
const rows = guideFacts({ ...page.place, admissionStored: page.admission.stored })
const facts = rows.filter((row) => row.key !== 'phone' && row.key !== 'website')
const contacts = rows.filter((row) => row.key === 'phone' || row.key === 'website')
const checkedLabel = russianDay(page.checkedAt)
const address = shortAddress(page.place.howToGet || '')
const noticeWindows = statusWindows(page.notices)
const hasFacts = Boolean(
  rows.length ||
  page.admission.stored ||
  page.admission.extrasStored ||
  page.notices.length ||
  address ||
  (page.place.latitude != null && page.place.longitude != null),
)
const hasCoords = page.place.latitude != null && page.place.longitude != null
const nearby = page.groups.find((group) => group.title === 'Рядом')
// Every published route through this place.
const routes = page.groups.find((group) => group.title === 'Маршруты')?.links ?? []
const SECTIONS = PAGE_SECTIONS
const eatNowSlug = page.eatNearby?.find((item) => item.regionSlug)?.regionSlug
const eatNowHref = eatNowSlug ? eatNowPath(eatNowSlug) : ''
// Text-width blocks (food nearby, directions, FAQ) stay in the article column
// beside the rail; only the wide «Рядом» grid runs full width after it.
const sectionsAfter = presentSections([
  [SECTIONS.upcoming, page.upcoming.length > 0],
  [SECTIONS.directions, Boolean(hasCoords || page.directionsHtml)],
  [SECTIONS.eatNearby, (page.eatNearby?.length ?? 0) > 0],
  [SECTIONS.placeRoutes, routes.length > 0],
  [SECTIONS.faq, page.faq.length > 0],
  [SECTIONS.nearby, Boolean(nearby)],
])
const heroSizes = '(min-width: 1000px) 720px, 100vw'
const heroPreload = page.cover ? lcpPreload(page.cover, heroSizes) : null
if (heroPreload) {
  useHead({ link: [heroPreload] })
}
usePublicHead(page.doc)
onMounted(() => useTrack().track('page_view', { placeSlug: slug }))
</script>

<style scoped>
.place-map {
  margin: 1rem 0 0;
}
.directions {
  margin-top: 3rem;
}
.routes {
  margin-top: 3rem;
}
.routes h2 {
  margin-bottom: 0.8rem;
}
.routes ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
.routes li {
  padding: 0.6rem 0;
  border-top: 1px solid var(--color-line);
}
.directions h2 {
  margin-bottom: 0.8rem;
}
.directions h2.with-sticker {
  display: flex;
  gap: 0.6rem;
  align-items: center;
}
.directions h2.with-sticker :deep(.sticker) {
  flex: none;
  width: 56px;
  margin: -0.6rem 0;
  transform: rotate(-6deg);
}
.directions-text {
  max-width: 65ch;
  line-height: 1.6;
}
.directions-text :deep(p) {
  margin: 0 0 0.6rem;
}
.hero {
  display: grid;
  gap: 1.6rem;
  align-items: center;
  padding-top: 0.4rem;
}
.hero-card {
  margin: 0.8rem 0.7rem 0.2rem 0.15rem;
}
.kicker {
  margin: 0 0 0.45rem;
  color: var(--color-brick);
  font-family: var(--font-stamp);
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.hero-copy h1 {
  margin: 0.35rem 0 0.7rem;
  font-size: clamp(2.35rem, 1.15rem + 2.5vw, 3.5rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
}
.lede {
  max-width: 38ch;
  color: var(--color-ink-soft);
  font-size: 1.12rem;
  line-height: 1.55;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 1.1rem;
}
.closed-note {
  margin: 1rem 0 0;
  color: var(--color-brick-dark);
  font-weight: 700;
}
.place-body {
  margin-top: 2.4rem;
}
.offers {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1.2rem;
}
.faq {
  margin-top: 3rem;
}
.faq h2 {
  margin: 0 0 0.9rem;
}
.faq-item {
  border-top: 1px solid var(--color-line);
}
.faq-item:last-child {
  border-bottom: 1px solid var(--color-line);
}
.faq-item summary {
  padding: 0.9rem 0;
  font-weight: 600;
  line-height: 1.4;
  cursor: pointer;
}
.faq-item p {
  margin: 0 0 1rem;
  max-width: 65ch;
  line-height: 1.6;
}
.sources-date {
  margin: 0 0 0.8rem;
}
.nearby-block {
  margin-top: 3rem;
}
.nearby-block h2 {
  margin-bottom: 1rem;
}
.nearby {
  display: flex;
  gap: 0.8rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding-bottom: 0.3rem;
}
.nearby > * {
  flex: 0 0 min(78%, 16rem);
  scroll-snap-align: start;
}
.sources {
  margin-top: 2.8rem;
  border-top: 1px solid var(--color-line);
  color: var(--muted);
  font-size: 0.88rem;
}
.sources summary {
  width: fit-content;
  padding: 0.75rem 0;
  color: var(--color-ink);
  font-weight: 600;
  cursor: pointer;
}
.sources ul {
  margin: 0 0 0.4rem;
  padding: 0;
  list-style: none;
}
.sources li {
  padding: 0.15rem 0;
}
.sources :deep(a) {
  color: var(--muted);
  font-weight: 500;
  text-underline-offset: 0.15em;
}
@media (min-width: 900px) {
  .nearby {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    overflow: visible;
  }
  .nearby > * {
    flex: none;
  }
}
@media (min-width: 1000px) {
  .hero {
    grid-template-columns: 1.2fr 0.95fr;
    gap: 3rem;
  }
  .place-body {
    margin-top: 4rem;
  }
}
</style>
