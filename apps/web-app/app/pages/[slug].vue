<template>
  <article class="page page-wide">
    <UiBreadcrumbs :crumbs="page.doc.crumbs" />
    <header class="hero">
      <div class="postcard">
        <img
          v-if="page.images[0]"
          :src="page.images[0].src"
          :alt="page.images[0].alt"
          :width="page.images[0].width || 640"
          :height="page.images[0].height || 400"
          fetchpriority="high"
        >
        <PostcardSketch
          v-else
          :label="page.doc.h1"
          :width="640"
          :height="400"
        />
        <span
          class="perf"
          aria-hidden="true"
        >{{ page.categoryTitle }}</span>
        <span
          class="postmark"
          aria-hidden="true"
        >{{ page.region?.title || 'K39' }}</span>
      </div>
      <div>
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
          >
            Как добраться
          </UiButton>
          <UiButton
            v-if="page.routeBand"
            :href="page.routeBand.href"
            variant="quiet"
          >
            В маршрут
          </UiButton>
        </p>
      </div>
    </header>
    <div class="columns">
      <section class="facts">
        <h2>Коротко</h2>
        <p><span>Часы</span> {{ page.place.hours || 'уточните' }}</p>
        <p><span>Цена</span> {{ page.place.price || 'уточните' }}</p>
        <p v-if="page.place.latitude != null && page.place.longitude != null">
          <span>Координаты</span>
          {{ page.place.latitude.toFixed(5) }}, {{ page.place.longitude.toFixed(5) }}
        </p>
      </section>
      <div class="article">
        <div
          class="prose"
          v-html="page.html"
        />
        <h2 v-if="page.sources.length">
          Источники
        </h2>
        <ul v-if="page.sources.length">
          <li
            v-for="source in page.sources"
            :key="source.url"
          >
            <a
              :href="source.url"
              rel="noopener"
            >{{ source.title }}</a>
          </li>
        </ul>
      </div>
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
    </div>
    <section v-if="nearby">
      <h2>Рядом</h2>
      <div class="card-grid">
        <PlaceCard
          v-for="link in nearby.links"
          :key="link.href"
          :href="link.href"
          :title="link.text"
          :distance-km="link.distanceKm"
        />
      </div>
    </section>
    <section
      v-if="page.routeBand"
      class="sea-band"
    >
      <p class="band-kicker">
        Маршрут
      </p>
      <h2>{{ page.routeBand.title }}</h2>
      <p v-if="page.routeBand.summary">
        {{ page.routeBand.summary }}
      </p>
      <ol>
        <li
          v-for="(step, index) in page.routeBand.steps"
          :key="step.href"
          :class="{ current: step.current }"
        >
          <span>{{ index + 1 }}</span>
          <a :href="step.href">{{ step.text }}</a>
        </li>
      </ol>
      <UiButton
        v-if="page.routeBand.next"
        :href="page.routeBand.next.href"
        variant="quiet"
      >
        Дальше: {{ page.routeBand.next.text }}
      </UiButton>
    </section>
    <LinkList
      v-for="group in otherGroups"
      :key="group.title"
      :title="group.title"
      :links="group.links"
    />
  </article>
</template>

<script setup lang="ts">
import type { SeoDocument } from '~~/shared/seo'

interface PlaceLink { href: string, text: string, distanceKm?: number | null }
interface PlacePage {
  doc: SeoDocument
  html: string
  place: { summary: string, status: string, hours: string | null, price: string | null, latitude: number | null, longitude: number | null }
  categoryTitle: string
  categorySlug: string
  region: { title: string } | null
  images: Array<{ src: string, alt: string, width: number | null, height: number | null }>
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
const nearby = page.groups.find((group) => group.title === 'Рядом')
const otherGroups = page.groups.filter((group) => group.title !== 'Рядом' && group.title !== 'Маршруты')
usePublicHead(page.doc)
onMounted(() => useTrack().track('page_view', { placeSlug: slug }))
</script>

<style scoped>
.hero {
  display: grid;
  gap: var(--space-5);
  align-items: center;
  margin-bottom: var(--space-6);
}
.postcard {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
.postcard img,
.postcard :deep(svg) { display: block; width: 100%; height: auto; }
.perf,
.postmark {
  position: absolute;
  font-family: var(--font-stamp);
  letter-spacing: 0.06em;
}
.perf {
  top: 0.7rem;
  right: 0.7rem;
  padding: 0.35rem 0.45rem;
  border: 2px dashed var(--color-brick);
  border-radius: 4px;
  background: var(--color-surface);
  color: var(--color-brick);
  font-size: 0.68rem;
  text-transform: uppercase;
}
.postmark {
  left: 0.8rem;
  bottom: 0.7rem;
  color: var(--color-brick);
  font-size: 0.75rem;
  transform: rotate(-8deg);
  opacity: 0.85;
}
.kicker {
  margin: 0 0 var(--space-2);
  color: var(--color-brick);
  font-family: var(--font-stamp);
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.lede { color: var(--muted); }
.tags,
.actions { display: flex; flex-wrap: wrap; gap: 0.45rem; }
.columns { display: grid; gap: var(--space-5); }
.facts {
  padding: var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: 16px;
  background: var(--surface);
}
.facts h2 { margin-top: 0; font-size: var(--step-1); }
.facts p { display: flex; flex-direction: column; gap: 0.15rem; margin-bottom: 0.7rem; }
.facts span {
  color: var(--muted);
  font-family: var(--font-stamp);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.offers { display: flex; flex-direction: column; gap: var(--space-4); }
.card-grid { margin-top: var(--space-3); }
.sea-band {
  margin-top: var(--space-6);
  padding: var(--space-5);
  border-radius: 20px;
  background: var(--color-sea);
  color: var(--color-surface);
}
.sea-band h2,
.sea-band p,
.sea-band a { color: inherit; }
.band-kicker {
  font-family: var(--font-stamp);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.75rem;
}
.sea-band ol { display: flex; flex-wrap: wrap; gap: 0.6rem 1rem; margin: 0 0 var(--space-4); padding: 0; list-style: none; }
.sea-band li { display: flex; gap: 0.4rem; align-items: baseline; }
.current a { font-weight: 700; }
@media (min-width: 900px) {
  .hero { grid-template-columns: 1.05fr 0.95fr; }
  .columns { grid-template-columns: 1.4fr 0.7fr; align-items: start; }
  .article { grid-column: 1; grid-row: 1 / span 3; }
  .facts,
  .offers { grid-column: 2; }
  .offers { margin-top: var(--space-4); }
}
</style>
