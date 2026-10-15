<template>
  <article class="page page-wide prices">
    <PageHeader
      :h1="page.doc.h1"
      :crumbs="page.doc.crumbs"
      kicker="Цены"
      :lede="page.doc.description"
    />
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
        </VenueCard>
      </li>
    </ul>
    <p class="note">
      Цены с официального меню или от заведения, не старше года. Сначала более низкие. Могли измениться.
    </p>
  </article>
</template>

<script setup lang="ts">
import type { PublicMedia } from '~~/shared/media'
import type { ScheduleRecord } from '~~/shared/schedule'
import type { SeoDocument } from '~~/shared/seo'

export interface PriceListingData {
  doc: SeoDocument
  item: { slug: string, title: string }
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

const props = defineProps<{ page: PriceListingData }>()

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
.ask {
  font-family: var(--font-display);
  font-size: 1.45rem;
  font-weight: 700;
  line-height: 1;
}
.portion { color: var(--muted); font-size: var(--step--1); }
.note { margin: 1.2rem 0 0; color: var(--muted); font-size: 0.92rem; }
</style>
