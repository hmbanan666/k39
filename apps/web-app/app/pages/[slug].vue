<template>
  <article class="page page-wide place">
    <UiBreadcrumbs :crumbs="page.doc.crumbs" />
    <header class="hero">
      <Postcard
        class="hero-card"
        :src="heroSrc"
        :alt="heroAlt"
        :caption="page.doc.h1"
        :meta="page.categoryTitle"
        tilt="-1.2deg"
        ratio="16 / 10"
        :stamp-src="illustrationFor(page.categorySlug, slug)"
        :stamp-label="page.categoryTitle"
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
            sizes="(min-width: 1000px) 720px, 100vw"
            @open="openPhoto(page.cover.id)"
          />
        </template>
      </Postcard>
      <div class="hero-copy">
        <p class="kicker">
          {{ page.categoryTitle }}<template v-if="page.region">
            · {{ page.region.title }}
          </template>
        </p>
        <h1>{{ page.doc.h1 }}</h1>
        <p class="lede">
          {{ page.place.summary }}
        </p>
        <p class="tags">
          <UiBadge
            :href="`/${page.categorySlug}`"
            tone="brick"
          >
            {{ page.categoryTitle }}
          </UiBadge>
          <UiTooltip :text="statusHint">
            <UiBadge tone="pine">
              {{ statusLabel }}
            </UiBadge>
          </UiTooltip>
        </p>
        <p class="actions">
          <UiButton
            v-if="yandex"
            :href="yandex"
            data-track="outbound"
            data-track-name="route"
          >
            Как добраться
          </UiButton>
          <UiButton
            v-if="page.routeBand"
            :href="page.routeBand.href"
            variant="line"
          >
            В маршрут
          </UiButton>
        </p>
      </div>
    </header>
    <div class="columns">
      <div class="article">
        <div
          class="prose"
          v-html="page.html"
        />
      </div>
      <aside class="aside">
        <section
          v-if="hasFacts"
          class="facts"
        >
          <h2>Коротко</h2>
          <div
            v-if="hours"
            class="fact"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            ><circle
              cx="12"
              cy="12"
              r="8"
            /><path d="M12 8v5l3 2" /></svg>
            <div>
              <p class="label">
                Часы
              </p>
              <p>{{ hours }}</p>
            </div>
          </div>
          <div
            v-if="price"
            class="fact"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            ><path d="M4 8h16v10H4z" /><path d="M8 8V6h8v2" /></svg>
            <div>
              <p class="label">
                Цена
              </p>
              <p>{{ price }}</p>
            </div>
          </div>
          <div
            v-if="address"
            class="fact"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            ><circle
              cx="12"
              cy="12"
              r="8"
            /><path d="M12 8l3 7-3-1.2L9 15z" /></svg>
            <div>
              <p class="label">
                Адрес
              </p>
              <p>{{ address }}</p>
            </div>
          </div>
          <div
            v-if="page.place.latitude != null && page.place.longitude != null"
            class="fact"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            ><path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z" /><circle
              cx="12"
              cy="11"
              r="1.6"
            /></svg>
            <div>
              <p class="label">
                Координаты
              </p>
              <p>
                {{ page.place.latitude.toFixed(5) }}, {{ page.place.longitude.toFixed(5) }}
                <UiLink
                  v-if="yandex"
                  :href="yandex"
                >
                  Яндекс Карты
                </UiLink>
              </p>
            </div>
          </div>
        </section>
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
      </aside>
    </div>
    <section
      v-if="morePhotos.length"
      class="gallery"
    >
      <h2>Фотографии</h2>
      <div class="gallery-grid">
        <PlacePhoto
          v-for="item in morePhotos"
          :key="item.id"
          :media="item"
          sizes="(min-width: 900px) 360px, 100vw"
          @open="openPhoto(item.id)"
        />
      </div>
    </section>
    <section
      v-if="nearby"
      class="nearby-block"
    >
      <h2>Рядом</h2>
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
    <RouteSteps
      v-if="page.routeBand"
      kicker="Маршрут"
      :title="page.routeBand.title"
      :summary="page.routeBand.summary"
      :href="page.routeBand.href"
      :steps="page.routeBand.steps"
      :next="page.routeBand.next"
      action="К маршруту"
    />
    <PhotoViewer
      v-if="photos.length"
      v-model:open="viewerOpen"
      v-model:index="viewerIndex"
      :photos="photos"
    />
    <LinkList
      v-for="group in otherGroups"
      :key="group.title"
      :title="group.title"
      :links="group.links"
    />
    <details
      v-if="page.sources.length"
      class="sources"
    >
      <summary>Источники</summary>
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
    </details>
  </article>
</template>

<script setup lang="ts">
import type { PublicMedia } from '~~/shared/media'
import type { SeoDocument } from '~~/shared/seo'
import { shortAddress } from '~~/shared/address'
import { illustrationFor } from '~~/shared/illustrations'

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
  place: {
    summary: string
    status: string
    hours: string | null
    price: string | null
    howToGet: string | null
    latitude: number | null
    longitude: number | null
  }
  categoryTitle: string
  categorySlug: string
  region: { title: string } | null
  images: Array<{ src: string, url: string, alt: string, width: number | null, height: number | null }>
  gallery: PublicMedia[]
  cover: PublicMedia | null
  groups: Array<{ title: string, links: PlaceLink[] }>
  sources: Array<{ title: string, url: string }>
  offers: Array<{ title: string, terms: string }>
  routeBand: null | {
    href: string
    title: string
    summary: string
    steps: Array<{ href: string, text: string, current: boolean }>
    next: { href: string, text: string } | null
  }
}

const route = useRoute()
const slug = String(route.params.slug || '')
const pageQuery = Number(route.query.page ?? 1)
const page = await fetchPublic<PlacePage>(`/api/public/places/${slug}`, { page: Number.isFinite(pageQuery) ? pageQuery : 1 })
const heroSrc = page.cover?.src || illustrationFor(page.categorySlug, slug)
const heroAlt = page.cover?.alt || page.doc.h1
const morePhotos = page.gallery.filter((item) => item.id !== page.cover?.id)
const photos = page.cover && !page.gallery.some((item) => item.id === page.cover?.id)
  ? [page.cover, ...page.gallery]
  : page.gallery
const viewerOpen = ref(false)
const viewerIndex = ref(0)
function openPhoto(id: string) {
  const found = photos.findIndex((item) => item.id === id)
  viewerIndex.value = found >= 0 ? found : 0
  viewerOpen.value = true
}
const statusLabel = ({ open: 'открыт', ruins: 'руины', closed: 'закрыт', unknown: 'статус неизвестен' } as Record<string, string>)[page.place.status] || page.place.status
const statusHint = ({
  open: 'По источникам сюда пускают посетителей.',
  ruins: 'Сохранились руины. Уточните, можно ли подойти.',
  closed: 'По источникам место закрыто для визита.',
  unknown: 'Статус визита в источниках не указан.',
} as Record<string, string>)[page.place.status] || 'Статус визита.'
const yandex = page.place.latitude != null
  ? `https://yandex.ru/maps/?rtext=~${page.place.latitude}%2C${page.place.longitude}&rtt=mt`
  : ''
const hours = page.place.hours?.trim() || ''
const price = page.place.price?.trim() || ''
const address = shortAddress(page.place.howToGet || '')
const hasFacts = Boolean(
  hours
  || price
  || address
  || (page.place.latitude != null && page.place.longitude != null),
)
const nearby = page.groups.find((group) => group.title === 'Рядом')
const otherGroups = page.groups.filter((group) => group.title !== 'Рядом' && group.title !== 'Маршруты')
usePublicHead(page.doc)
onMounted(() => useTrack().track('page_view', { placeSlug: slug }))
</script>

<style scoped>
.hero {
  display: grid;
  gap: 1.6rem;
  align-items: center;
  padding-top: 0.4rem;
}
.hero-card { margin: 0.8rem 0.7rem 0.2rem 0.15rem; }
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
  color: #433832;
  font-size: 1.12rem;
  line-height: 1.55;
}
.tags,
.actions { display: flex; flex-wrap: wrap; gap: 0.45rem; }
.tags { margin: 1rem 0 1.1rem; }
.columns { display: grid; gap: 1.6rem; margin-top: 2.4rem; }
.aside { display: grid; gap: 1.2rem; align-content: start; }
.facts {
  position: relative;
  overflow: hidden;
  padding: 1.2rem 1.15rem 0.4rem;
  border: 1px solid var(--color-line);
  border-radius: 14px;
  background: var(--color-surface);
}
.facts::before {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 6px;
  background: repeating-linear-gradient(90deg, var(--color-brick) 0 18px, transparent 18px 26px, var(--color-sea) 26px 44px, transparent 44px 52px);
}
.facts h2 { margin: 0.35rem 0 0.3rem; font-size: 1.35rem; }
.fact {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 0.7rem;
  padding: 0.8rem 0;
  border-top: 1px dashed var(--color-line);
}
.fact:first-of-type { border-top: 0; }
.fact svg {
  width: 22px;
  height: 22px;
  margin-top: 0.15rem;
  fill: none;
  stroke: var(--color-brick);
  stroke-width: 1.7;
}
.fact p { margin: 0; font-size: 0.97rem; line-height: 1.45; }
.fact .label {
  margin-bottom: 0.3rem;
  color: var(--muted);
  font: 600 0.72rem/1 var(--font-body);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.fact a { font-weight: 600; }
.offers { display: flex; flex-direction: column; gap: 1rem; }
.gallery { margin-top: 2.5rem; }
.gallery-grid {
  display: grid;
  gap: 1rem;
}
.nearby-block { margin-top: 3rem; }
.nearby-block h2 { margin-bottom: 1rem; }
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
.sources li { padding: 0.15rem 0; }
.sources :deep(a) {
  color: var(--muted);
  font-weight: 500;
  text-underline-offset: 0.15em;
}
@media (max-width: 999px) {
  .aside { display: contents; }
  .facts { order: -1; }
}
@media (min-width: 720px) {
  .gallery-grid { grid-template-columns: 1fr 1fr; }
}
@media (min-width: 900px) {
  .nearby {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    overflow: visible;
  }
  .nearby > * { flex: none; }
}
@media (min-width: 1000px) {
  .hero { grid-template-columns: 1.2fr 0.95fr; gap: 3rem; }
  .columns {
    grid-template-columns: 1fr 22.5rem;
    gap: 3.5rem;
    margin-top: 4rem;
    align-items: start;
  }
}
</style>
