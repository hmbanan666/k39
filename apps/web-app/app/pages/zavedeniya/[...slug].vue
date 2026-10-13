<template>
  <VenueListing
    v-if="listing"
    :page="listing"
  />
  <article
    v-else-if="venue"
    class="page page-wide venue"
  >
    <UiBreadcrumbs :crumbs="venue.doc.crumbs" />
    <header class="hero">
      <div>
        <p class="kicker">
          {{ venue.kindLabel }}<template v-if="venue.region">
            · {{ venue.region.title }}
          </template>
        </p>
        <h1>{{ venue.doc.h1 }}</h1>
        <p
          v-if="venue.closed"
          class="note"
        >
          Закрыто
        </p>
        <p
          v-if="venue.stale"
          class="note"
        >
          Давно не проверяли
        </p>
      </div>
    </header>
    <div
      v-if="venue.html"
      class="prose"
      v-html="venue.html"
    />
    <section
      v-if="facts"
      class="facts"
    >
      <h2>Коротко</h2>
      <p v-if="venue.hours.length">
        <span>Часы</span> {{ venue.hours.join('; ') }}
      </p>
      <p v-if="venue.priceLevel || venue.avgCheck">
        <span>Чек</span> {{ [venue.priceLevel, venue.avgCheck].filter(Boolean).join(', ') }}
      </p>
      <p v-if="venue.venue.address">
        <span>Адрес</span> {{ venue.venue.address }}
      </p>
      <p v-if="venue.venue.phone">
        <span>Телефон</span> <a :href="`tel:${venue.venue.phone}`">{{ venue.venue.phone }}</a>
      </p>
      <p v-if="venue.venue.website">
        <span>Сайт</span>
        <UiLink :href="venue.venue.website">
          {{ venue.venue.website }}
        </UiLink>
      </p>
    </section>
    <section v-if="venue.venue.latitude != null && venue.venue.longitude != null">
      <h2>На карте</h2>
      <ClientOnly>
        <VenueMap
          :latitude="venue.venue.latitude"
          :longitude="venue.venue.longitude"
          :title="venue.doc.h1"
        />
      </ClientOnly>
      <p>
        <UiLink :href="mapLink">
          Открыть в Яндекс Картах
        </UiLink>
      </p>
    </section>
    <section v-if="venue.gallery.length">
      <h2>Фото</h2>
      <div class="photos">
        <PlacePhoto
          v-for="photo in venue.gallery"
          :key="photo.id"
          :media="photo"
          sizes="(min-width: 800px) 360px, 100vw"
        />
      </div>
    </section>
    <LinkList
      v-if="venue.places.length"
      title="Рядом"
      :links="venue.places"
    />
    <details
      v-if="venue.sources.length"
      class="sources"
    >
      <summary>Источники</summary>
      <ul>
        <li
          v-for="source in venue.sources"
          :key="source.url"
        >
          <UiLink :href="source.url">
            {{ source.title }}
          </UiLink>
        </li>
      </ul>
    </details>
  </article>
</template>

<script setup lang="ts">
import type { PublicMedia } from '~~/shared/media'
import type { SeoDocument } from '~~/shared/seo'
import type { VenueHours, VenueSocials } from '~~/shared/venues'

interface ListingPage {
  doc: SeoDocument
  h1: string
  summary: string
  region: { slug: string, title: string } | null
  kind: { slug: string, label: string, plural: string } | null
  regions: Array<{ slug: string, title: string }>
  kinds: Array<{ slug: string, label: string }>
  items: Array<{
    href: string
    name: string
    kindLabel: string
    address: string | null
    stale: boolean
    closed: boolean
    price: string
  }>
}

interface VenuePage {
  doc: SeoDocument
  venue: {
    address: string | null
    phone: string | null
    website: string | null
    latitude: number | null
    longitude: number | null
    hours: VenueHours
    socials: VenueSocials
    description: string
  }
  region: { slug: string, title: string } | null
  kindLabel: string
  hours: string[]
  priceLevel: string
  avgCheck: string
  stale: boolean
  closed: boolean
  gallery: PublicMedia[]
  sources: Array<{ title: string, url: string }>
  places: Array<{ href: string, text: string, distanceKm?: number | null }>
  html: string
}

const route = useRoute()
const raw = route.params.slug
const path = (Array.isArray(raw) ? raw : [raw]).filter(Boolean).join('/')
const payload = await fetchPublic<
  { kind: 'listing', page: ListingPage } | { kind: 'venue', page: VenuePage }
>(`/api/public/zavedeniya/${path}`)
const listing = payload.kind === 'listing' ? payload.page : null
const venue = payload.kind === 'venue' ? payload.page : null
const facts = computed(() => {
  const page = venue
  if (!page) {
    return false
  }
  return Boolean(page.hours.length || page.priceLevel || page.avgCheck || page.venue.address || page.venue.phone || page.venue.website)
})
const mapLink = computed(() => {
  const page = venue
  if (!page || page.venue.latitude == null || page.venue.longitude == null) {
    return ''
  }
  return `https://yandex.ru/maps/?pt=${page.venue.longitude},${page.venue.latitude}&z=16&l=map`
})
usePublicHead(payload.page.doc)
</script>

<style scoped>
.kicker {
  margin: 0 0 0.45rem;
  color: var(--color-brick);
  font-family: var(--font-stamp);
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
h1 { margin: 0.2rem 0 0.8rem; }
.note { color: var(--muted); }
.facts p { margin: 0.35rem 0; }
.facts span {
  display: inline-block;
  min-width: 5.5rem;
  color: var(--muted);
}
.photos { display: grid; gap: 0.8rem; }
.sources { margin-top: 1.5rem; }
@media (min-width: 800px) {
  .photos { grid-template-columns: 1fr 1fr; }
}
</style>
