<template>
  <article class="page page-wide prices">
    <PageHeader
      :h1="page.doc.h1"
      :crumbs="page.doc.crumbs"
      kicker="Цены"
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
    <ul>
      <li
        v-for="item in page.items"
        :key="item.slug"
        :class="{ current: from === item.slug }"
      >
        <VenueCard
          :href="item.href"
          :name="item.name"
          :kind-label="item.kindLabel"
          :media="item.media"
          :meta="item.meta"
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
    </ul>
    <p class="note">
      Цены с официального меню или от заведения, не старше года. Сначала более низкие. Могли измениться.
    </p>
  </article>
</template>

<script setup lang="ts">
import type { FoodStickerSlug } from '~~/shared/food-stickers'
import type { PublicMedia } from '~~/shared/media'
import type { ScheduleRecord } from '~~/shared/schedule'
import type { SeoDocument } from '~~/shared/seo'
import { PRICE_STICKER_WIDTH } from '~~/shared/price-compare'
import { usePublicHead } from '~/composables/usePublicHead'

export interface PriceListingData {
  doc: SeoDocument
  item: { slug: string, title: string, image: string | null, sticker: FoodStickerSlug | null }
  regionSlug: string | null
  towns: Array<{ slug: string, title: string, href: string, count: number }>
  oblastHref: string
  items: Array<{
    href: string
    slug: string
    name: string
    kindLabel: string
    media: PublicMedia | null
    schedule: ScheduleRecord | null
    stale: boolean
    meta: string
    priceLabel: string
    variant: string
  }>
}

const props = defineProps<{ page: PriceListingData, from?: string }>()

usePublicHead(props.page.doc)
</script>

<style scoped>
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
ul {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}
li { display: flex; min-width: 0; }
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
