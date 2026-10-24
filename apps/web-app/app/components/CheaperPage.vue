<template>
  <article class="page page-wide cheaper">
    <PageHeader
      :h1="page.doc.h1"
      :crumbs="page.doc.crumbs"
      kicker="Где дешевле"
      :lede="page.doc.description"
    />
    <nav
      v-if="page.cities.length"
      class="towns"
      aria-label="Территории"
    >
      <a
        v-for="city in page.cities"
        :key="city.slug"
        :href="city.href"
        :aria-current="page.regionSlug === city.slug ? 'page' : undefined"
      >{{ city.title }} <span>{{ city.places }}</span></a>
    </nav>
    <ul
      v-if="page.items.length"
      class="dishes"
    >
      <li
        v-for="item in page.items"
        :key="item.slug"
      >
        <a :href="item.href">
          <span class="mark">
            <Sticker
              v-if="item.sticker"
              set="food"
              :slug="item.sticker"
              :width="PRICE_STICKER_WIDTH"
              decorative
            />
            <img
              v-else-if="item.image"
              :src="item.image"
              alt=""
            >
          </span>
          <span class="name">{{ item.title }}</span>
          <span class="price">{{ formatRub(item.medianRub) }}</span>
          <span class="meta">{{ formatPriceSpan(item.minRub, item.maxRub) }}, {{ item.places }}</span>
        </a>
      </li>
    </ul>
    <p
      v-else-if="!page.cities.length"
      class="empty"
    >
      Пока ни на одной территории нет трёх сопоставимых цен из официального меню.
    </p>
  </article>
</template>

<script setup lang="ts">
import type { FoodStickerSlug } from '~~/shared/food-stickers'
import type { SeoDocument } from '~~/shared/seo'
import { formatPriceSpan, formatRub, PRICE_STICKER_WIDTH } from '~~/shared/price-compare'
import { usePublicHead } from '~/composables/usePublicHead'

export interface CheaperCityLink {
  slug: string
  title: string
  href: string
  places: string
  venueCount: number
}

export interface CheaperItemLink {
  slug: string
  title: string
  href: string
  image: string | null
  sticker: FoodStickerSlug | null
  medianRub: number
  minRub: number
  maxRub: number
  places: string
}

export interface CheaperPageData {
  doc: SeoDocument
  regionSlug?: string | null
  cities: CheaperCityLink[]
  items: CheaperItemLink[]
}

const props = defineProps<{ page: CheaperPageData }>()

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
.dishes {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.dishes a {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  grid-template-areas: 'mark name price' 'mark meta price';
  column-gap: 0.85rem;
  align-items: center;
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: inherit;
  text-decoration: none;
}
.dishes a:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
.mark {
  display: grid;
  grid-area: mark;
  place-items: center;
  width: 56px;
  height: 56px;
  overflow: hidden;
}
.mark :deep(picture.sticker),
.mark :deep(picture.sticker img),
.mark img {
  display: block;
  width: 56px;
  height: 56px;
  max-width: 56px;
  max-height: 56px;
  object-fit: contain;
}
.name {
  grid-area: name;
  font-weight: 700;
}
.meta {
  grid-area: meta;
  color: var(--muted);
  font-size: var(--step--1);
}
.price {
  grid-area: price;
  font-family: var(--font-display);
  font-size: 1.55rem;
  font-weight: 700;
  line-height: 1;
}
.empty { margin: 0; color: var(--muted); }
@media (max-width: 420px) {
  .dishes a {
    grid-template-columns: 56px 1fr;
    grid-template-areas: 'mark name' 'mark price' 'mark meta';
  }
  .price { margin-top: 0.15rem; }
}
</style>
