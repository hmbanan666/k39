<template>
  <article class="page page-wide">
    <UiBreadcrumbs :crumbs="page.doc.crumbs" />
    <header>
      <h1>{{ page.h1 }}</h1>
      <p
        v-if="page.summary"
        class="lede"
      >
        {{ page.summary }}
      </p>
    </header>
    <nav
      class="filters"
      aria-label="Фильтры"
    >
      <a
        href="/zavedeniya"
        :class="{ on: !page.region && !page.kind }"
      >Все</a>
      <a
        v-for="region in page.regions"
        :key="region.slug"
        :href="`/zavedeniya/${region.slug}`"
      >{{ region.title }}</a>
      <a
        v-for="kind in page.kinds"
        v-show="page.region"
        :key="kind.slug"
        :href="`/zavedeniya/${page.region?.slug}/${kind.slug}`"
        :class="{ on: page.kind?.slug === kind.slug }"
      >{{ kind.label }}</a>
    </nav>
    <p v-if="!page.items.length">
      Пока нет заведений в этом списке.
    </p>
    <ul v-else>
      <li
        v-for="item in page.items"
        :key="item.href"
      >
        <a :href="item.href">{{ item.name }}</a>
        <span>{{ item.kindLabel }}</span>
        <span v-if="item.address">{{ item.address }}</span>
        <span v-if="item.price">{{ item.price }}</span>
        <small v-if="item.closed">Закрыто</small>
        <small v-if="item.stale">Давно не проверяли</small>
      </li>
    </ul>
  </article>
</template>

<script setup lang="ts">
import type { SeoDocument } from '~~/shared/seo'

defineProps<{
  page: {
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
}>()
</script>

<style scoped>
.lede { max-width: 46rem; }
.filters { display: flex; flex-wrap: wrap; gap: 0.4rem 0.8rem; margin: 1rem 0 1.4rem; }
.filters a { color: var(--color-ink); }
.filters a.on { font-weight: 700; }
ul { margin: 0; padding: 0; list-style: none; }
li {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.8rem;
  align-items: baseline;
  padding: 0.7rem 0;
  border-top: 1px solid var(--color-line);
}
a { color: var(--color-ink); font-weight: 700; text-decoration: none; }
span, small { color: var(--muted); font-size: var(--step--1); }
</style>
