<template>
  <article class="page page-wide venue">
    <UiBreadcrumbs :crumbs="page.doc.crumbs" />
    <header
      class="hero"
      :class="{ 'hero-sticker': !cover }"
    >
      <Postcard
        class="hero-card"
        :src="cover?.src || illustrationFor('food')"
        :alt="cover?.alt || page.doc.h1"
        :caption="caption"
        tilt="-1.2deg"
        ratio="16 / 10"
        :stamp-src="illustrationFor('food')"
        stamp-place="out"
        postmark
        priority
        :width="cover?.width || 1200"
        :height="cover?.height || 750"
      >
        <template #art>
          <!-- Bento from the concept: one big photo, up to two small ones. -->
          <div
            v-if="cover"
            class="bento"
            :class="`bento-${heroPhotos.length}`"
          >
            <PlacePhoto
              v-for="(photo, index) in heroPhotos"
              :key="photo.id"
              :class="index === 0 ? 'bento-main' : 'bento-side'"
              :media="photo"
              :priority="index === 0"
              :sizes="index === 0 ? heroSizes : '(min-width: 1000px) 240px, 35vw'"
              @open="openPhoto(photo.id)"
            />
          </div>
          <!-- No photo yet: one mascot sticker instead of a stock picture. -->
          <div
            v-else
            class="sticker-art"
          >
            <Sticker
              :slug="heroSticker"
              :width="220"
              decorative
              priority
            />
          </div>
        </template>
      </Postcard>
      <div class="hero-copy">
        <p
          v-if="kickerParts.length"
          class="kicker"
        >
          <span
            v-for="(part, index) in kickerParts"
            :key="index"
          >{{ part }}</span>
        </p>
        <h1>{{ page.doc.h1 }}</h1>
        <p
          v-if="venue.summary"
          class="lede"
        >
          {{ venue.summary }}
        </p>
        <p
          v-if="venue.closed"
          class="closed-note"
        >
          {{ venue.closedNote }}
        </p>
        <ul
          v-if="chips.length"
          class="chips"
        >
          <li
            v-for="chip in chips"
            :key="chip"
          >
            {{ chip }}
          </li>
        </ul>
        <p
          v-if="venue.address"
          class="hero-where"
        >
          {{ venue.address }}
        </p>
      </div>
    </header>
    <div class="venue-body">
      <ReaderLayout
        :html="venue.html"
        :sections-before="sectionsBefore"
        :sections-after="sectionsAfter"
      >
        <template #body>
          <p
            v-if="venue.stale"
            class="stale-note"
          >
            {{ venue.staleNote }}
          </p>
          <VenueModules
            v-if="modules"
            :blocks="orderedBlocks"
            :menu-url="venue.menuUrl"
          />
          <template v-else>
            <h2
              v-if="venue.html"
              :id="ABOUT.id"
            >
              {{ ABOUT.title }}
            </h2>
            <ProseHtml
              v-if="venue.html"
              class="reader-html"
              :html="venue.html"
            />
          </template>
        </template>
        <template #lead>
          <section class="facts">
            <h2>Коротко</h2>
            <OpeningLive
              :schedule="venue.schedule"
              :has-hours="Boolean(venue.schedule) || venue.hours.length > 0"
            />
            <div
              v-if="actions.primary || actions.secondary.length || hasCoords"
              class="acts"
            >
              <MetaLink
                v-if="actions.primary"
                class="btn act-main"
                :href="actions.primary.href"
                data-track="outbound"
                :data-track-name="actions.primary.key"
              >
                {{ actions.primary.label }}
              </MetaLink>
              <MetaLink
                v-for="action in actions.secondary"
                :key="action.key"
                class="btn btn-line"
                :href="action.href"
                data-track="outbound"
                :data-track-name="action.key"
              >
                {{ action.label }}
              </MetaLink>
              <DirectionsLink
                v-if="hasCoords"
                variant="line"
                :latitude="venue.latitude!"
                :longitude="venue.longitude!"
                :entity="`/zavedeniya/${venue.slug}`"
              />
            </div>
            <div
              v-for="row in facts"
              :key="row.key"
              class="fact"
            >
              <Icon
                :name="tablerIcon(row.key)"
                size="22"
              />
              <div>
                <p class="label">
                  {{ row.label }}
                </p>
                <p
                  v-for="line in row.lines"
                  :key="line"
                >
                  {{ line }}
                </p>
              </div>
            </div>
            <div
              v-if="venue.socials.length"
              class="fact"
            >
              <Icon
                :name="tablerIcon('social')"
                size="22"
              />
              <div>
                <p class="label">
                  Соцсети
                </p>
                <p class="socials">
                  <UiLink
                    v-for="social in venue.socials"
                    :key="social.url"
                    :href="social.url"
                    data-track="outbound"
                    data-track-name="social"
                  >
                    {{ socialLabel(social.network) }}
                  </UiLink>
                </p>
              </div>
            </div>
            <p
              v-if="checkedLabel"
              class="checked"
            >
              <Icon
                :name="tablerIcon('checked')"
                size="16"
              />
              Проверено {{ checkedLabel }}
            </p>
          </section>
          <aside class="owner">
            <Sticker
              slug="with-smartphone"
              :width="64"
              decorative
            />
            <p>
              Вы из «{{ venue.name }}»? Подтвердите страницу и правьте фото, часы и меню сами.
              <a :href="venueClaimPath(venue.slug)">Это моё заведение</a>
            </p>
          </aside>
        </template>
      </ReaderLayout>
      <div class="venue-tail">
        <section
          v-if="showLegacyOrder"
          :id="SECTIONS.order.id"
          class="block"
        >
          <h2>{{ SECTIONS.order.title }}</h2>
          <ul
            v-if="venue.dishes.length"
            class="dishes"
          >
            <li
              v-for="dish in venue.dishes"
              :key="dish.name"
            >
              <span class="dish-name">{{ dish.name }}</span>
              <span
                v-if="dish.priceRub"
                class="dish-price"
              >{{ rub(dish.priceRub) }}</span>
              <span
                v-if="dish.note"
                class="dish-note"
              >{{ dish.note }}</span>
            </li>
          </ul>
          <p v-if="venue.menuUrl">
            <UiLink
              :href="venue.menuUrl"
              data-track="outbound"
              data-track-name="menu"
            >
              Всё меню на сайте заведения
            </UiLink>
          </p>
        </section>
        <section
          v-if="interior.length"
          :id="SECTIONS.inside.id"
          class="block"
        >
          <h2>{{ SECTIONS.inside.title }}</h2>
          <div class="inside">
            <PlacePhoto
              v-for="photo in interior"
              :key="photo.id"
              :media="photo"
              sizes="(min-width: 900px) 260px, 50vw"
              @open="openPhoto(photo.id)"
            />
          </div>
        </section>
        <section
          v-if="showDirections"
          :id="PAGE_SECTIONS.directions.id"
          class="block"
        >
          <h2 :class="{ 'with-sticker': howToGetHtml }">
            {{ PAGE_SECTIONS.directions.title }}
            <Sticker
              v-if="howToGetHtml"
              slug="with-map"
              :width="72"
              decorative
            />
          </h2>
          <p v-if="showStreet">
            {{ venue.address }}
          </p>
          <ProseHtml
            v-if="howToGetHtml"
            class="reader-html"
            :html="howToGetHtml"
          />
          <MapEmbed
            v-if="hasCoords"
            class="venue-map"
            label="Карта заведения"
            :focus-href="`/zavedeniya/${venue.slug}`"
            :latitude="venue.latitude!"
            :longitude="venue.longitude!"
          />
        </section>
        <section
          v-if="page.places.length"
          :id="SECTIONS.see.id"
          class="block"
        >
          <h2>{{ SECTIONS.see.title }}</h2>
          <div class="near">
            <PlaceCard
              v-for="place in page.places"
              :key="place.href"
              meta-place="stack"
              :href="place.href"
              :title="place.text"
              :distance-km="place.distanceKm"
              :kind="place.kind || ''"
              :media="place.media"
            />
          </div>
          <p
            v-if="page.farPlaces.length"
            class="far"
          >
            На машине:
            <template
              v-for="(place, index) in page.farPlaces"
              :key="place.href"
            >
              <NuxtLink :to="place.href">
                {{ place.text }}
              </NuxtLink>
              ({{ formatKm(place.distanceKm) }}){{ index < page.farPlaces.length - 1 ? ', ' : '' }}
            </template>
          </p>
        </section>
        <details
          v-if="venue.sources.length"
          class="sources"
        >
          <summary>{{ PAGE_SECTIONS.sources.title }}</summary>
          <p v-if="checkedLabel">
            Факты проверены {{ checkedLabel }}.
            <a
              :href="errorHref"
              data-track="outbound"
              data-track-name="venue-error"
            >Сообщить об ошибке</a>
          </p>
          <ul>
            <li
              v-for="source in venue.sources"
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
      </div>
    </div>
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
import type { ScheduleRecord } from '~~/shared/schedule'
import type { SeoDocument } from '~~/shared/seo'
import type { StickerSlug } from '~~/shared/stickers'
import type { PublicVenueModules } from '~~/shared/venue-modules'
import { htmlContainsAddress } from '~~/shared/address'
import { venueClaimPath } from '~~/shared/cabinet'
import { tablerIcon } from '~~/shared/icons'
import { illustrationFor } from '~~/shared/illustrations'
import { lcpPreload } from '~~/shared/media'
import { operator } from '~~/shared/operator'
import { PAGE_SECTIONS, presentSections } from '~~/shared/page-sections'
import { russianDay } from '~~/shared/place-guide'
import { socialLabel, venueActions, venueServiceNotes } from '~~/shared/venue-actions'
import { presentVenueBlocks } from '~~/shared/venue-modules'

export interface VenuePageData {
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
    cuisine: string[]
    socials: Array<{ network: string, url: string }>
    bookingUrl: string | null
    orderUrl: string | null
    deliveryUrl: string | null
    menuUrl: string | null
    reservation: string | null
    takeaway: boolean | null
    delivery: boolean | null
    dishes: Array<{ name: string, note?: string | null, priceRub?: number | null }>
    summary: string
    checkedAt: string | null
    regionTitle: string | null
    schedule: ScheduleRecord | null
    modules: PublicVenueModules | null
  }
  photos: PublicMedia[]
  cover: PublicMedia | null
  places: Array<{ href: string, text: string, distanceKm: number, kind: string | null, media: PublicMedia | null }>
  farPlaces: Array<{ href: string, text: string, distanceKm: number }>
}

const props = defineProps<{ page: VenuePageData }>()
const venue = props.page.venue
const cover = props.page.cover
const photos = props.page.photos
// Hero takes the cover plus up to two more; «Как внутри» shows the rest.
const heroPhotos = cover
  ? [cover, ...photos.filter((photo) => photo.id !== cover.id).slice(0, 2)]
  : []
const interior = photos.filter((photo) => !heroPhotos.some((shown) => shown.id === photo.id)).slice(0, 6)

const ABOUT = { id: 'o-meste', title: 'О месте' }
const SECTIONS = {
  order: { id: 'chto-zakazat', title: 'Что заказать' },
  inside: { id: 'kak-vnutri', title: 'Как внутри' },
  see: { id: 'ryadom-posmotret', title: 'Рядом посмотреть' },
}

const modules = venue.modules
const orderedBlocks = modules ? presentVenueBlocks(modules.blocks) : []
const hasDishesModule = Boolean(modules?.blocks.some((block) => block.type === 'dishes'))
const showLegacyOrder = !hasDishesModule && venue.dishes.length > 0
const hasCoords = venue.latitude != null && venue.longitude != null
const howToGetHtml = modules?.howToGetHtml ?? null
const showDirections = Boolean(howToGetHtml) || hasCoords
const sectionsBefore = modules
  ? orderedBlocks.map((block) => ({ id: block.id, title: block.title }))
  : presentSections([[ABOUT, Boolean(venue.html)]])
const sectionsAfter = presentSections([
  [SECTIONS.order, showLegacyOrder],
  [SECTIONS.inside, interior.length > 0],
  [PAGE_SECTIONS.directions, showDirections],
  [SECTIONS.see, props.page.places.length > 0],
])

const kickerParts = [venue.kindLabel, venue.regionTitle].filter(Boolean)
const showStreet = Boolean(venue.address) && !htmlContainsAddress(howToGetHtml, venue.address)
const caption = venue.address ? venue.address.replace(/^[^,]+,\s*/, '') : venue.name
const actions = venueActions(venue)
const chips = [...venue.cuisine.slice(0, 3), ...venueServiceNotes(venue)]
const checkedLabel = russianDay(venue.checkedAt)
const rub = (value: number) => `${new Intl.NumberFormat('ru-RU').format(value)} ₽`

const facts = [
  { key: 'cuisine', label: 'Кухня', lines: venue.cuisine.length ? [venue.cuisine.join(', ')] : [] },
  { key: 'price', label: 'Цены', lines: [[venue.price, venue.avgCheck].filter(Boolean).join(', ')].filter(Boolean) },
  { key: 'hours', label: 'Часы', lines: venue.hours },
  { key: 'address', label: 'Адрес', lines: venue.address ? [venue.address] : [] },
  { key: 'phone', label: 'Телефон', lines: venue.phone ? [venue.phone] : [] },
].filter((row) => row.lines.length)

function heroStickerFor(): StickerSlug {
  const tags = venue.cuisine.join(' ')
  if (/рыба|морепродукты/.test(tags)) {
    return 'with-smoked-fish'
  }
  if (venue.kind === 'coffee' || venue.kind === 'bakery') {
    return 'with-coffee-and-croissant'
  }
  if (venue.kind === 'bar') {
    return 'with-lemonade'
  }
  if (venue.kind === 'fastfood') {
    return 'hungry'
  }
  return 'cook-with-pan'
}
const heroSticker = heroStickerFor()

const errorHref = `mailto:${operator.email}?subject=${encodeURIComponent(`Ошибка на странице: ${venue.name}`)}`
const formatKm = (km: number) => km < 10 ? `${km.toFixed(1).replace('.', ',')} км` : `${Math.round(km)} км`

const heroSizes = '(min-width: 1000px) 720px, 100vw'
const heroPreload = cover ? lcpPreload(cover, heroSizes) : null
if (heroPreload) {
  useHead({ link: [heroPreload] })
}

const viewerOpen = ref(false)
const viewerIndex = ref(0)
function openPhoto(id: string) {
  const found = photos.findIndex((item) => item.id === id)
  viewerIndex.value = found >= 0 ? found : 0
  viewerOpen.value = true
}
</script>

<style scoped>
.hero {
  display: grid;
  gap: 1.35rem;
  align-items: start;
  padding-top: 0.35rem;
}
.hero-card { margin: 0.85rem 0.85rem 0.15rem 0.1rem; }
.hero-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}
.bento {
  display: grid;
  gap: 0.35rem;
  width: 100%;
  aspect-ratio: 16 / 10;
}
.bento-2 { grid-template-columns: 1.6fr 1fr; }
.bento-3 { grid-template-columns: 1.6fr 1fr; grid-template-rows: 1fr 1fr; }
.bento-3 .bento-main { grid-row: 1 / 3; }
.bento :deep(.shot) { min-width: 0; min-height: 0; overflow: hidden; }
.bento :deep(.frame),
.bento :deep(picture) { height: 100%; }
.bento :deep(img) { height: 100%; aspect-ratio: auto; }
.sticker-art {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 12.5rem;
  padding: 1.15rem 1.75rem 0.45rem 0.55rem;
  background: linear-gradient(165deg, var(--color-sea-light), var(--color-amber-soft));
}
.sticker-art :deep(.sticker) { width: min(220px, 72%); }
.sticker-art :deep(img) { width: 100%; height: auto; }
.kicker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem 0.85rem;
  margin: 0 0 0.4rem;
  color: var(--color-brick);
  font-family: var(--font-stamp);
  font-size: 1.15rem;
  line-height: 1.2;
}
.hero-copy h1 {
  margin: 0 0 0.7rem;
  font-size: clamp(2.4rem, 1.2rem + 2.6vw, 3.6rem);
  line-height: 1.02;
  letter-spacing: -0.02em;
}
.hero-where { display: none; }
.lede {
  max-width: 38ch;
  color: var(--color-ink);
  font-size: 1.12rem;
  line-height: 1.55;
}
.closed-note { margin: 1rem 0 0; color: var(--color-brick-dark); font-weight: 700; }
.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 1rem 0 0; padding: 0; list-style: none; }
.chips li {
  padding: 0.28rem 0.75rem;
  border-radius: 999px;
  background: var(--color-amber-soft);
  color: var(--color-partner);
  font-size: 0.92rem;
}
.venue-body { margin-top: 2.4rem; }
.stale-note { color: var(--color-warn); }
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
.acts { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.9rem 0 0.4rem; }
.acts > * { flex: 1 1 calc(50% - 0.5rem); justify-content: center; text-align: center; }
.acts .act-main { flex-basis: 100%; }
.fact {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 0.7rem;
  padding: 0.8rem 0;
  border-top: 1px dashed var(--color-line);
}
.fact svg { width: 22px; height: 22px; margin-top: 0.15rem; color: var(--color-brick); }
.fact p { margin: 0; font-size: 0.97rem; line-height: 1.45; }
.fact .label {
  margin-bottom: 0.2rem;
  color: var(--muted);
  font: 600 0.84rem/1.2 var(--font-body);
}
.socials { display: flex; flex-wrap: wrap; gap: 0.3rem 0.8rem; }
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
.owner {
  display: flex;
  gap: 0.8rem;
  align-items: center;
  margin-top: 1rem;
  padding: 0.8rem 1rem;
  border: 1px solid var(--color-line);
  border-radius: 14px;
  background: var(--color-surface);
  color: var(--muted);
  font-size: 0.88rem;
  line-height: 1.45;
}
.owner p { margin: 0; }
.owner a { font-weight: 600; }
.block { margin-top: 3rem; }
.block h2 { margin-bottom: 0.9rem; }
.block h2.with-sticker { display: flex; gap: 0.6rem; align-items: center; }
.block h2.with-sticker :deep(.sticker) { flex: none; width: 56px; margin: -0.6rem 0; transform: rotate(-6deg); }
.dishes { margin: 0 0 1rem; padding: 0; list-style: none; }
.dishes li {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.1rem 1rem;
  padding: 0.7rem 0;
  border-top: 1px solid var(--color-line);
}
.dish-name { font-weight: 700; }
.dish-price { color: var(--muted); white-space: nowrap; }
.dish-note { grid-column: 1 / -1; color: var(--muted); font-size: 0.92rem; }
.inside { display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); gap: 0.8rem; }
.venue-map { margin-top: 0.8rem; }
.near {
  display: flex;
  gap: 0.8rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding-bottom: 0.3rem;
}
.near > * { flex: 0 0 min(78%, 16rem); scroll-snap-align: start; }
.venue-tail { margin-top: 2.6rem; }
.venue-tail :deep(figure.embed) { height: 22rem; }
.sources {
  max-width: 65ch;
  margin-top: 2.8rem;
  border-top: 1px solid var(--color-line);
  color: var(--muted);
  font-size: 0.92rem;
}
.sources summary { width: fit-content; padding: 0.75rem 0; color: var(--color-ink); font-weight: 600; cursor: pointer; }
.sources a { font-weight: 600; }
.far { margin-top: 0.9rem; color: var(--muted); font-size: 0.92rem; }
.sources ul { margin: 0 0 0.4rem; padding: 0; list-style: none; }
@media (min-width: 1000px) {
  .hero { grid-template-columns: 1.15fr 0.9fr; gap: 2.75rem; align-items: stretch; }
  .hero-copy { padding-top: 0.35rem; }
  .hero-sticker { grid-template-columns: minmax(16rem, 24rem) minmax(0, 1fr); gap: 2.5rem; }
  .hero-sticker .sticker-art :deep(.sticker) { width: min(220px, 68%); }
  .hero-where {
    display: block;
    margin: 1.15rem 0 0;
    color: var(--color-brick-dark);
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-style: italic;
    font-weight: 500;
    line-height: 1.3;
  }
  .hero-sticker .hero-where { margin-top: auto; padding-top: 1.15rem; }
  .venue-body { margin-top: 3rem; }
  .venue-tail :deep(figure.embed) { height: 26rem; }
  .near { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); overflow: visible; }
  .near > * { flex: none; }
}
</style>
