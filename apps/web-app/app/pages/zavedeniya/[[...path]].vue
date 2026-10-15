<template>
  <ArticleShell
    v-if="page.type === 'listing'"
    :h1="page.doc.h1"
    :crumbs="page.doc.crumbs"
    kicker="Еда и напитки"
    :lede="page.doc.description"
  >
    <nav
      class="filters"
      aria-label="Фильтры"
    >
      <a href="/zavedeniya">Все</a>
      <a
        v-for="region in page.filters.regions"
        :key="region.slug"
        :href="region.href"
        :aria-current="region.slug === page.regionSlug ? 'page' : undefined"
      >{{ region.title }}</a>
      <a
        v-for="kind in page.filters.kinds"
        :key="kind.kind"
        :href="kind.href"
        :aria-current="kind.kind === page.kind ? 'page' : undefined"
      >{{ kind.label }}</a>
      <button
        type="button"
        class="open-now"
        :aria-pressed="openNow"
        :disabled="filtering"
        @click="toggleOpen"
      >
        Открыто сейчас
      </button>
    </nav>
    <div
      v-if="page.html"
      class="prose"
      v-html="page.html"
    />
    <p
      v-if="openNow"
      class="open-note"
    >
      Учитываются только проверенные часы работы.
    </p>
    <section
      v-if="mapHrefs.length"
      class="town-map"
    >
      <h2 :id="PAGE_SECTIONS.map.id">
        {{ PAGE_SECTIONS.map.title }}
      </h2>
      <MapEmbed
        :label="mapLabel"
        :focus-href="mapHrefs[0] || '/zavedeniya'"
        :hrefs="mapHrefs"
      />
    </section>
    <ul
      v-if="shownItems.length"
      class="card-grid cols-3 cards"
    >
      <li
        v-for="(item, index) in shownItems"
        :key="item.href"
      >
        <VenueCard
          :href="item.href"
          :name="item.name"
          :kind-label="item.kindLabel"
          :media="item.media"
          :meta="cardMeta(item)"
          :stale="item.stale"
          :schedule="item.schedule"
          :lean="index % 2 === 0 ? 'left' : 'right'"
          sizes="(min-width: 1100px) 380px, (min-width: 720px) 46vw, 92vw"
          :priority="index < 2"
        />
      </li>
    </ul>
    <p
      v-if="!shownItems.length"
      class="empty"
    >
      {{ openNow ? 'Сейчас нет открытых заведений с проверенными часами.' : 'В этом списке пока нет опубликованных заведений.' }}
    </p>
  </ArticleShell>
  <VenuePage
    v-else
    :page="page"
  />
</template>

<script setup lang="ts">
import type { PublicMedia } from '~~/shared/media'
import type { ScheduleRecord } from '~~/shared/schedule'
import type { SeoDocument } from '~~/shared/seo'
import type { VenuePageData } from '~/components/VenuePage.vue'
import { PAGE_SECTIONS } from '~~/shared/page-sections'

interface ListingItem {
  href: string
  slug: string
  name: string
  kindLabel: string
  address: string | null
  cuisine: string[]
  price: string
  avgCheck: string
  stale: boolean
  latitude: number | null
  longitude: number | null
  media: PublicMedia | null
  schedule: ScheduleRecord | null
}

interface ListingPage {
  type: 'listing'
  doc: SeoDocument
  html: string
  heading: string
  regionSlug: string | null
  kind: string | null
  filters: {
    regions: Array<{ slug: string, title: string, href: string }>
    kinds: Array<{ kind: string, label: string, href: string }>
  }
  items: ListingItem[]
}

const route = useRoute()
const page = await fetchPublic<ListingPage | VenuePageData>('/api/public/zavedeniya', { path: route.path })
// «Открыто сейчас» runs in the browser only, after hydration (ADR 0028).
const openNow = ref(false)
const filtering = ref(false)
const openSlugs = ref(new Set<string>())
const slugOf = (href: string) => href.split('/').filter(Boolean).pop() || ''
const openState = (href: string) => openSlugs.value.has(slugOf(href))
const shownItems = computed(() => {
  if (page.type !== 'listing') {
    return []
  }
  return openNow.value ? page.items.filter((item) => openState(item.href)) : page.items
})
// A town fits the compact embed. The whole oblast does not: pins would cover the coast.
// «Открыто сейчас» is applied only after the hours request, so the map does not unmount on an empty set.
const mapHrefs = computed(() => {
  if (page.type !== 'listing' || !page.regionSlug) {
    return []
  }
  const source = openNow.value ? shownItems.value : page.items
  return source.flatMap((item) => item.latitude != null && item.longitude != null ? [item.href] : [])
})
const mapLabel = computed(() => page.type === 'listing' ? `Карта: ${page.heading}` : 'Карта')

function cardMeta(item: ListingItem) {
  return [item.address, item.cuisine.join(', '), item.price, item.avgCheck].filter(Boolean).join(' · ')
}

async function toggleOpen() {
  if (openNow.value) {
    openNow.value = false
    return
  }
  filtering.value = true
  try {
    // Same rule as the map: only verified schedules report «open».
    const result = await $fetch<{ items: Array<{ slug: string }> }>('/api/public/availability', { query: { type: 'venue', status: 'open,closing_soon' } }).catch(() => ({ items: [] }))
    openSlugs.value = new Set(result.items.map((item) => item.slug))
    openNow.value = true
  } finally {
    filtering.value = false
  }
}

usePublicHead(page.doc)
</script>

<style scoped>
.filters { display: flex; flex-wrap: wrap; gap: 0.5rem 0.9rem; margin: 0 0 1.5rem; }
.filters a { color: var(--color-sea); }
.open-now {
  padding: 0.1rem 0.7rem;
  border: 1px solid var(--color-sea);
  border-radius: 999px;
  background: transparent;
  color: var(--color-sea);
  font: inherit;
  cursor: pointer;
}
.open-now[aria-pressed='true'] { background: var(--color-sea); color: var(--color-paper, #fff); }
.open-now:disabled { opacity: 0.6; cursor: progress; }
.open-note { margin: 0 0 1rem; color: var(--color-muted); font-size: 0.95rem; }
.town-map { margin: 0.4rem 0 1.6rem; }
.town-map h2 { margin: 0 0 0.7rem; }
.cards { margin: 0.2rem 0 0; padding: 0; list-style: none; }
.cards li { display: flex; min-width: 0; }
.places { margin: 0; padding: 0; list-style: none; }
.places li {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.8rem;
  padding: 0.7rem 0;
  border-top: 1px solid var(--color-line);
}
.facts { display: grid; grid-template-columns: 7rem 1fr; gap: 0.35rem 1rem; margin: 1.2rem 0; }
.facts dt { color: var(--muted); }
.facts dd { margin: 0; }
.facts p { margin: 0; }
.photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); gap: 0.8rem; margin-bottom: 1rem; }
.directions { margin: 0.4rem 0 0.9rem; }
.venue-map { margin: 0 0 1.2rem; }
.stale, .stale-note { color: var(--color-warn); }
.stale-note { margin: 0 0 1rem; }
.sources { margin-top: 2rem; }
.empty { color: var(--muted); }
@media (max-width: 640px) {
  .facts { grid-template-columns: 1fr; }
}
</style>
