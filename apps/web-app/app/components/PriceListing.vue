<template>
  <article class="page page-wide prices">
    <PageHeader
      :h1="page.doc.h1"
      :crumbs="page.doc.crumbs"
      kicker="Где дешевле"
      :lede="page.doc.description"
    >
      <template
        v-if="page.item.sticker || page.item.image"
        #mark
      >
        <span class="item-mark">
          <Sticker
            v-if="page.item.sticker"
            set="food"
            :slug="page.item.sticker"
            :width="PRICE_STICKER_WIDTH"
            decorative
          />
          <img
            v-else
            class="item-art"
            :src="page.item.image ?? ''"
            alt=""
          >
        </span>
      </template>
    </PageHeader>
    <nav
      v-if="page.towns.length"
      class="towns"
      aria-label="Где сравнить"
    >
      <a
        :href="page.oblastHref"
        :aria-current="page.regionSlug ? undefined : 'page'"
      >Вся область</a>
      <a
        v-for="town in page.towns"
        :key="town.slug"
        :href="town.href"
        :aria-current="town.slug === page.regionSlug ? 'page' : undefined"
      >{{ town.title }} <span>{{ town.count }}</span></a>
    </nav>
    <dl
      v-if="page.stats"
      class="figures"
    >
      <div>
        <dt>Медиана</dt>
        <dd>{{ formatRub(page.stats.medianRub) }}</dd>
      </div>
      <div>
        <dt>Диапазон</dt>
        <dd>{{ formatPriceSpan(page.stats.minRub, page.stats.maxRub) }}</dd>
      </div>
      <div>
        <dt>Мест</dt>
        <dd>{{ page.stats.places }}</dd>
      </div>
    </dl>
    <p
      v-if="page.stats?.freshness"
      class="fresh"
    >
      {{ page.stats.freshness }}
    </p>
    <ol>
      <li
        v-for="(item, index) in page.items"
        :key="item.slug"
        :class="{ current: from === item.slug }"
      >
        <span class="rank">{{ index + 1 }}</span>
        <VenueCard
          :href="item.href"
          :name="item.name"
          :kind-label="item.kindLabel"
          :media="item.media"
          :meta="item.meta"
          :phone="item.phone"
          :stale="item.stale"
          :schedule="item.schedule"
          lean="none"
        >
          <template #kicker>
            <span class="ask">{{ item.priceLabel }}</span>
            <span
              v-if="item.variant"
              class="portion"
            >{{ item.variant }}</span>
          </template>
          <span
            v-if="from === item.slug"
            class="here"
          >Это заведение</span>
        </VenueCard>
      </li>
    </ol>
    <p
      v-if="page.stats?.source"
      class="note"
    >
      <UiLink
        v-if="page.stats.source.url"
        :href="page.stats.source.url"
      >
        {{ page.stats.source.title }}
      </UiLink>
      <template v-else>
        {{ page.stats.source.title }}
      </template>,
      <time :datetime="page.stats.source.date">{{ formatPriceDate(page.stats.source.date) }}</time>
      Цены могли измениться.
    </p>
  </article>
</template>

<script setup lang="ts">
import type { FoodStickerSlug } from '~~/shared/food-stickers'
import type { PublicMedia } from '~~/shared/media'
import type { SharedPriceSource } from '~~/shared/price-compare'
import type { ScheduleRecord } from '~~/shared/schedule'
import type { SeoDocument } from '~~/shared/seo'
import { formatPriceDate, formatPriceSpan, formatRub, PRICE_STICKER_WIDTH } from '~~/shared/price-compare'
import { usePublicHead } from '~/composables/usePublicHead'

export interface PriceListingData {
  doc: SeoDocument
  item: { slug: string, title: string, image: string | null, sticker: FoodStickerSlug | null }
  regionSlug: string | null
  towns: Array<{ slug: string, title: string, href: string, count: number }>
  oblastHref: string
  stats?: {
    medianRub: number
    minRub: number
    maxRub: number
    places: number
    freshness: string
    source: SharedPriceSource | null
  }
  items: Array<{
    href: string
    slug: string
    name: string
    kindLabel: string
    media: PublicMedia | null
    schedule: ScheduleRecord | null
    stale: boolean
    meta: string
    phone?: string | null
    priceLabel: string
    variant: string
  }>
}

const props = defineProps<{ page: PriceListingData, from?: string }>()

usePublicHead(props.page.doc)
</script>

<style scoped>
.figures {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem 1.6rem;
  margin: 0 0 0.7rem;
}
.figures div { min-width: 6.5rem; }
.figures dt {
  margin: 0;
  color: var(--muted);
  font-size: var(--step--1);
}
.figures dd {
  margin: 0.1rem 0 0;
  font-family: var(--font-display);
  font-size: 1.7rem;
  font-weight: 700;
  line-height: 1.1;
}
.fresh { margin: 0 0 1.2rem; color: var(--muted); }
.towns { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0 0 1.4rem; }
.towns a {
  padding: 0.3rem 0.8rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  text-decoration: none;
}
.towns a span { color: var(--muted); font-size: var(--step--1); }
.towns a[aria-current='page'] { border-color: var(--accent); color: var(--accent); font-weight: 700; }
ol {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: cheaper;
}
li { display: flex; min-width: 0; position: relative; }
li :deep(.card) { flex: 1; min-width: 0; }
.rank {
  position: absolute;
  z-index: 1;
  top: 0.45rem;
  left: 0.45rem;
  display: grid;
  width: 1.6rem;
  height: 1.6rem;
  place-items: center;
  border-radius: 99px;
  background: var(--surface);
  color: var(--color-sea);
  font-family: var(--font-display);
  font-weight: 700;
  line-height: 1;
}
li.current :deep(.card) { box-shadow: 0 0 0 2px var(--color-sea); }
.here { color: var(--color-sea); font-size: 0.82rem; font-weight: 700; }
.ask {
  font-family: var(--font-display);
  font-size: 1.45rem;
  font-weight: 700;
  line-height: 1;
}
.portion { color: var(--muted); font-size: var(--step--1); }
.note { margin: 1.2rem 0 0; color: var(--muted); font-size: 0.92rem; }
.item-mark {
  display: grid;
  flex: none;
  place-items: center;
  width: 56px;
  height: 56px;
  overflow: hidden;
}
.item-mark :deep(picture.sticker),
.item-mark :deep(picture.sticker img),
.item-mark .item-art {
  display: block;
  width: 56px;
  height: 56px;
  max-width: 56px;
  max-height: 56px;
  object-fit: contain;
}
</style>
