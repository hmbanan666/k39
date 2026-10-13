<template>
  <article class="karta">
    <header>
      <p class="kicker">
        Область
      </p>
      <h1>Карта</h1>
      <p class="lede">
        Места, маршруты и заведения Калининградской области. Нажмите точку, чтобы открыть карточку.
      </p>
    </header>
    <K39Map
      variant="page"
      label="Карта Калининградской области"
    />
  </article>
</template>

<script setup lang="ts">
import { breadcrumbNode, DEFAULT_OG_IMAGE, metaDescription, pageTitle } from '~~/shared/seo'

const crumbs = [
  { name: 'Главная', href: '/' },
  { name: 'Карта', href: '/karta' },
]
usePublicHead({
  title: pageTitle('Карта'),
  description: metaDescription('Карта мест, маршрутов и заведений Калининградской области.'),
  canonical: 'https://k39.online/karta',
  robots: 'index, follow',
  h1: 'Карта',
  crumbs,
  ogImage: DEFAULT_OG_IMAGE,
  jsonLd: [breadcrumbNode(crumbs)],
})
</script>

<style scoped>
.karta {
  width: min(var(--wide), calc(100% - 1rem));
  margin: 0 auto;
  padding: 1rem 0 2rem;
}
.kicker {
  margin: 0;
  color: var(--color-brick);
  font-family: var(--font-stamp);
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
h1 { margin: 0.2rem 0 0.35rem; font-size: var(--step-2); }
.lede { margin: 0 0 0.8rem; max-width: 42rem; color: var(--muted); }
</style>
