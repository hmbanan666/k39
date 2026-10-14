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
            :sizes="heroSizes"
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
          <DirectionsLink
            v-if="page.place.latitude != null && page.place.longitude != null"
            :latitude="page.place.latitude"
            :longitude="page.place.longitude"
            :entity="`/${slug}`"
          />
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
    <div class="place-body">
      <ReaderLayout
        :html="page.html"
        :sections-after="sectionsAfter"
      >
        <template
          v-if="hasFacts || page.offers.length"
          #lead
        >
          <section
            v-if="hasFacts"
            class="facts"
          >
            <h2>Коротко</h2>
            <div
              v-for="row in facts"
              :key="row.key"
              class="fact"
            >
              <Icon :name="tablerIcon(row.key)" size="22" />
              <div>
                <p class="label">
                  {{ row.label }}
                </p>
                <p>{{ row.value }}</p>
              </div>
            </div>
            <div
              v-if="address"
              class="fact"
            >
              <Icon :name="tablerIcon('address')" size="22" />
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
              <Icon :name="tablerIcon('coordinates')" size="22" />
              <div>
                <p class="label">
                  Координаты
                </p>
                <p>
                  {{ page.place.latitude.toFixed(5) }}, {{ page.place.longitude.toFixed(5) }}
                  <UiLink
                    v-if="yandex"
                    :href="yandex"
                    data-track="directions"
                    data-track-name="directions"
                    :data-track-entity="`/${slug}`"
                  >
                    Яндекс Карты
                  </UiLink>
                </p>
              </div>
            </div>
            <p
              v-if="checkedLabel"
              class="checked"
            >
              <Icon :name="tablerIcon('checked')" size="16" />
              Проверено {{ checkedLabel }}
            </p>
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
        </template>
        <template #after>
          <section
            v-if="hasCoords || page.directionsHtml"
            :id="SECTIONS.directions.id"
            class="directions"
          >
            <h2>{{ SECTIONS.directions.title }}</h2>
            <div
              v-if="page.directionsHtml"
              class="directions-text"
              v-html="page.directionsHtml"
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
        </template>
      </ReaderLayout>
    </div>
    <section
      v-if="nearby || page.eatNearby?.length"
      :id="SECTIONS.nearby.id"
      class="nearby-block"
    >
      <h2>{{ SECTIONS.nearby.title }}</h2>
      <div
        v-if="nearby"
        class="nearby"
      >
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
      <VenueNearby
        class="nearby-eat"
        :items="page.eatNearby || []"
        title="Где поесть"
        level="h3"
      />
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
import type { PublicMedia } from '~~/shared/media'
import type { SeoDocument } from '~~/shared/seo'
import { shortAddress } from '~~/shared/address'
import { yandexDestinationUrl } from '~~/shared/embed-map'
import { tablerIcon } from '~~/shared/icons'
import { illustrationFor } from '~~/shared/illustrations'
import { lcpPreload } from '~~/shared/media'
import { PAGE_SECTIONS, presentSections } from '~~/shared/page-sections'
import { guideFacts, russianDay } from '~~/shared/place-guide'

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
  faq: Array<{ question: string, answer: string }>
  checkedAt: string | null
  place: {
    summary: string
    visitDuration: string | null
    bestTime: string | null
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
  eatNearby: Array<{
    href: string
    slug: string
    name: string
    kindLabel: string
    distance: string
    partner: boolean
    stale: boolean
  }>
}

const route = useRoute()
const slug = String(route.params.slug || '')
const pageQuery = Number(route.query.page ?? 1)
const page = await fetchPublic<PlacePage>(`/api/public/places/${slug}`, { page: Number.isFinite(pageQuery) ? pageQuery : 1 })
const heroSrc = page.cover?.src || illustrationFor(page.categorySlug, slug)
const heroAlt = page.cover?.alt || page.doc.h1
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
const yandex = page.place.latitude != null && page.place.longitude != null
  ? yandexDestinationUrl(page.place.latitude, page.place.longitude)
  : ''
const facts = guideFacts(page.place)
const checkedLabel = russianDay(page.checkedAt)
const address = shortAddress(page.place.howToGet || '')
const hasFacts = Boolean(
  facts.length
  || address
  || (page.place.latitude != null && page.place.longitude != null),
)
const hasCoords = page.place.latitude != null && page.place.longitude != null
const nearby = page.groups.find((group) => group.title === 'Рядом')
const SECTIONS = PAGE_SECTIONS
// Text-width blocks stay in the article column beside the rail; only the
// wide «Рядом» grid runs full width after it.
const sectionsAfter = presentSections([
  [SECTIONS.directions, Boolean(hasCoords || page.directionsHtml)],
  [SECTIONS.faq, page.faq.length > 0],
  [SECTIONS.sources, page.sources.length > 0],
  [SECTIONS.nearby, Boolean(nearby || page.eatNearby?.length)],
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
.place-map { margin: 1rem 0 0; }
.directions { margin-top: 3rem; }
.directions h2 { margin-bottom: 0.8rem; }
.directions-text { max-width: 65ch; line-height: 1.6; }
.directions-text :deep(p) { margin: 0 0 0.6rem; }
.nearby-eat { margin-top: 1.6rem; }
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
.place-body { margin-top: 2.4rem; }
.offers { display: flex; flex-direction: column; gap: 1rem; margin-top: 1.2rem; }
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
.checked {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  margin: 0;
  padding: 0.7rem 0 0.8rem;
  border-top: 1px dashed var(--color-line);
  color: var(--color-pine, var(--muted));
  font: 600 0.8rem/1.2 var(--font-body);
}
.checked svg { flex: none; }
.faq { margin-top: 3rem; }
.faq h2 { margin: 0 0 0.9rem; }
.faq-item {
  border-top: 1px solid var(--color-line);
}
.faq-item:last-child { border-bottom: 1px solid var(--color-line); }
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
.sources-date { margin: 0 0 0.8rem; }
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
  .place-body { margin-top: 4rem; }
}
</style>
