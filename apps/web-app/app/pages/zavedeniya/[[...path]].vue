<template>
  <ArticleShell
    v-if="page.type === 'listing'"
    :h1="page.doc.h1"
    :crumbs="page.doc.crumbs"
    kicker="Еда и напитки"
    :lede="page.doc.description"
  >
    <nav
      class="pick"
      aria-label="Города"
    >
      <p class="pick-label">
        Города
      </p>
      <ul class="towns">
        <li>
          <a
            class="town town-all"
            :href="page.filters.allTownsHref"
            :aria-current="page.regionSlug ? undefined : 'page'"
          >
            <span class="shot plain">
              <Icon
                :name="tablerIcon('address')"
                size="22"
              />
            </span>
            <span class="town-copy">
              <span class="town-name">Вся область</span>
            </span>
          </a>
        </li>
        <li
          v-for="town in page.filters.towns"
          :key="town.slug"
        >
          <a
            class="town"
            :href="town.href"
            :aria-current="town.slug === page.regionSlug ? 'page' : undefined"
          >
            <span class="shot">
              <MediaImage
                v-if="town.media"
                :media="town.media"
                :show-credit="false"
                sizes="80px"
              />
              <img
                v-else
                :src="town.image"
                alt=""
                width="80"
                height="80"
              >
            </span>
            <span class="town-copy">
              <span class="town-name">{{ town.title }}</span>
              <span class="town-count">{{ venueCount(town.count) }}</span>
            </span>
          </a>
        </li>
      </ul>
    </nav>
    <nav
      class="pick"
      aria-label="Что поесть"
    >
      <p class="pick-label">
        Что поесть
      </p>
      <div class="themes">
        <a
          class="theme"
          :href="page.filters.allKindsHref"
          :aria-current="page.kind ? undefined : 'page'"
        >Все</a>
        <a
          v-for="kind in page.filters.kinds"
          :key="kind.kind"
          class="theme"
          :href="kind.href"
          :aria-current="kind.kind === page.kind ? 'page' : undefined"
        >
          <Icon
            :name="tablerIcon(kind.kind)"
            size="18"
          />
          {{ kind.label }}
        </a>
        <button
          type="button"
          class="open-now"
          :aria-pressed="openNow"
          :disabled="filtering"
          @click="toggleOpen"
        >
          Открыто сейчас
        </button>
      </div>
    </nav>
    <ProseHtml
      v-if="page.html"
      class="prose"
      :html="page.html"
    />
    <ListingModules
      v-if="leadModules.length"
      :blocks="leadModules"
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
          :phone="item.phone"
          :stale="item.stale"
          :schedule="item.schedule"
          :notices="item.notices"
          :lean="index % 2 === 0 ? 'left' : 'right'"
          sizes="(min-width: 1100px) 380px, (min-width: 720px) 46vw, 92vw"
          :priority="index < 2"
        />
      </li>
    </ul>
    <ListingModules
      v-if="tailModules.length"
      :blocks="tailModules"
    />
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
import type { PublicListingModule } from '~~/shared/listing-modules'
import type { PublicMedia } from '~~/shared/media'
import type { NoticeWindow } from '~~/shared/notices'
import type { ScheduleRecord } from '~~/shared/schedule'
import type { SeoDocument } from '~~/shared/seo'
import type { VenuePageData } from '~/components/VenuePage.vue'
import { tablerIcon } from '~~/shared/icons'
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
  phone: string | null
  stale: boolean
  latitude: number | null
  longitude: number | null
  media: PublicMedia | null
  schedule: ScheduleRecord | null
  notices: NoticeWindow[]
}

interface ListingPage {
  type: 'listing'
  doc: SeoDocument
  html: string
  modules: PublicListingModule[]
  heading: string
  regionSlug: string | null
  kind: string | null
  filters: {
    allTownsHref: string
    allKindsHref: string
    towns: Array<{
      slug: string
      title: string
      href: string
      count: number
      media: PublicMedia | null
      image: string
    }>
    kinds: Array<{ kind: string, label: string, href: string }>
  }
  items: ListingItem[]
}

const route = useRoute()
const page = await fetchPublic<ListingPage | VenuePageData>('/api/public/zavedeniya', { path: route.path })
const listingModules = page.type === 'listing' ? page.modules : []
const leadModules = listingModules.filter((block) => block.type === 'choose' || block.type === 'situation')
const tailModules = listingModules.filter((block) => block.type !== 'choose' && block.type !== 'situation')
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

function venueCount(count: number) {
  const mod100 = Math.abs(count) % 100
  const mod10 = mod100 % 10
  const word = mod100 > 10 && mod100 < 20
    ? 'заведений'
    : mod10 === 1
      ? 'заведение'
      : mod10 > 1 && mod10 < 5
        ? 'заведения'
        : 'заведений'
  return `${count} ${word}`
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
.pick { margin: 0 0 1.15rem; }
.pick-label {
  margin: 0 0 0.45rem;
  color: var(--muted);
  font: 700 0.72rem/1 var(--font-body);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.towns {
  display: flex;
  gap: 0.6rem;
  margin: 0;
  padding: 0.15rem 0.1rem 0.45rem;
  list-style: none;
  overflow-x: auto;
}
@media (min-width: 900px) {
  .towns { flex-wrap: wrap; overflow: visible; }
}
.town {
  display: flex;
  gap: 0.55rem;
  align-items: center;
  min-width: 12rem;
  padding: 0.35rem 0.75rem 0.35rem 0.35rem;
  border-radius: var(--radius-md);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  color: inherit;
  text-decoration: none;
}
.town[aria-current='page'] { outline: 2px solid var(--accent); outline-offset: 1px; }
.shot {
  display: grid;
  flex: 0 0 3.4rem;
  place-items: center;
  width: 3.4rem;
  height: 3.4rem;
  overflow: hidden;
  border-radius: 8px;
  background: var(--color-amber-soft);
}
.shot.plain { color: var(--accent); }
.shot :deep(figure),
.shot :deep(picture) {
  display: block;
  width: 100%;
  height: 100%;
  margin: 0;
}
.shot img,
.shot :deep(img) {
  display: block;
  width: 100%;
  height: 100%;
  aspect-ratio: auto;
  object-fit: cover;
}
.town-copy { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
.town-name { font-weight: 700; line-height: 1.2; }
.town-count { color: var(--muted); font-size: var(--step--1); }
.themes { display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: center; }
.theme {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: var(--color-amber-soft);
  color: inherit;
  font-weight: 600;
  text-decoration: none;
}
.theme[aria-current='page'] { background: var(--accent); color: var(--surface); }
.open-now {
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--color-sea);
  border-radius: 999px;
  background: transparent;
  color: var(--color-sea);
  font: inherit;
  font-weight: 600;
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
