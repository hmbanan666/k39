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
    </nav>
    <div
      v-if="page.html"
      class="prose"
      v-html="page.html"
    />
    <ul class="list">
      <li
        v-for="item in page.items"
        :key="item.href"
      >
        <a :href="item.href">{{ item.name }}</a>
        <span>{{ item.kindLabel }}</span>
        <span v-if="item.address">{{ item.address }}</span>
        <span v-if="item.avgCheck">{{ item.avgCheck }}</span>
        <span
          v-if="item.stale"
          class="stale"
        >Давно не проверяли</span>
      </li>
    </ul>
    <p
      v-if="!page.items.length"
      class="empty"
    >
      В этом списке пока нет опубликованных заведений.
    </p>
  </ArticleShell>
  <ArticleShell
    v-else
    :h1="page.doc.h1"
    :crumbs="page.doc.crumbs"
    :kicker="page.venue.kindLabel"
    :lede="page.venue.closed ? page.venue.closedNote : ''"
  >
    <p
      v-if="page.venue.stale"
      class="stale-note"
    >
      {{ page.venue.staleNote }}
    </p>
    <div
      v-if="page.photos.length"
      class="photos"
    >
      <PlacePhoto
        v-for="(photo, index) in page.photos"
        :key="photo.id"
        :media="photo"
        :priority="index === 0"
        :sizes="heroSizes"
        @open="openPhoto(photo.id)"
      />
    </div>
    <dl class="facts">
      <template v-if="page.venue.hours.length">
        <dt>Часы</dt>
        <dd>
          <p
            v-for="line in page.venue.hours"
            :key="line"
          >
            {{ line }}
          </p>
        </dd>
      </template>
      <template v-if="page.venue.avgCheck || page.venue.price">
        <dt>Чек</dt>
        <dd>{{ [page.venue.price, page.venue.avgCheck].filter(Boolean).join(', ') }}</dd>
      </template>
      <template v-if="page.venue.address">
        <dt>Адрес</dt>
        <dd>{{ page.venue.address }}</dd>
      </template>
      <template v-if="page.venue.phone">
        <dt>Телефон</dt>
        <dd><a :href="`tel:${page.venue.phone}`">{{ page.venue.phone }}</a></dd>
      </template>
      <template v-if="page.venue.website">
        <dt>Сайт</dt>
        <dd>
          <UiLink
            :href="page.venue.website"
            data-track="outbound"
            data-track-name="website"
          >
            {{ page.venue.website }}
          </UiLink>
        </dd>
      </template>
    </dl>
    <p
      v-if="page.venue.latitude != null && page.venue.longitude != null"
      class="directions"
    >
      <DirectionsLink
        :latitude="page.venue.latitude"
        :longitude="page.venue.longitude"
        :entity="`/zavedeniya/${page.venue.slug}`"
      />
    </p>
    <MapEmbed
      v-if="page.venue.latitude != null && page.venue.longitude != null"
      class="venue-map"
      label="Карта заведения"
      :focus-href="`/zavedeniya/${page.venue.slug}`"
      :latitude="page.venue.latitude"
      :longitude="page.venue.longitude"
    />
    <div
      v-if="page.venue.description"
      class="prose"
      v-html="page.venue.html"
    />
    <section v-if="page.places.length">
      <h2>Места рядом</h2>
      <ul class="places">
        <li
          v-for="place in page.places"
          :key="place.href"
        >
          <a :href="place.href">{{ place.text }}</a>
        </li>
      </ul>
    </section>
    <details
      v-if="page.venue.sources.length"
      class="sources"
    >
      <summary>Источники</summary>
      <ul>
        <li
          v-for="source in page.venue.sources"
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
    </details>
    <PhotoViewer
      v-if="page.photos.length"
      v-model:open="viewerOpen"
      v-model:index="viewerIndex"
      :photos="page.photos"
    />
  </ArticleShell>
</template>

<script setup lang="ts">
import type { PublicMedia } from '~~/shared/media'
import type { SeoDocument } from '~~/shared/seo'
import { lcpPreload } from '~~/shared/media'

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
  items: Array<{
    href: string
    name: string
    kindLabel: string
    address: string | null
    price: string
    avgCheck: string
    stale: boolean
  }>
}

interface VenuePage {
  type: 'venue'
  doc: SeoDocument
  venue: {
    name: string
    kind: string
    kindLabel: string
    partner: boolean
    address: string | null
    phone: string | null
    website: string | null
    price: string
    avgCheck: string
    hours: string[]
    description: string
    html: string
    slug: string
    latitude: number | null
    longitude: number | null
    stale: boolean
    staleNote: string
    closed: boolean
    closedNote: string
    sources: Array<{ title: string, url: string }>
  }
  photos: PublicMedia[]
  places: Array<{ href: string, text: string, distanceKm: number }>
}

const route = useRoute()
const page = await fetchPublic<ListingPage | VenuePage>('/api/public/zavedeniya', { path: route.path })
const heroSizes = '(min-width: 900px) 360px, 100vw'
const hero = page.type === 'venue' ? page.photos[0] : null
const heroPreload = hero ? lcpPreload(hero, heroSizes) : null
if (heroPreload) {
  useHead({ link: [heroPreload] })
}
usePublicHead(page.doc)
const viewerOpen = ref(false)
const viewerIndex = ref(0)
function openPhoto(id: string) {
  if (page.type !== 'venue') {
    return
  }
  const found = page.photos.findIndex((item) => item.id === id)
  viewerIndex.value = found >= 0 ? found : 0
  viewerOpen.value = true
}
</script>

<style scoped>
.filters { display: flex; flex-wrap: wrap; gap: 0.5rem 0.9rem; margin: 0 0 1.5rem; }
.filters a { color: var(--color-sea); }
.list, .places { margin: 0; padding: 0; list-style: none; }
.list li, .places li {
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
