<template>
  <section v-if="links.length">
    <h2>{{ title }}</h2>
    <ul>
      <li
        v-for="link in links"
        :key="link.href"
      >
        <a :href="link.href">{{ link.text }}</a>
        <span v-if="link.distanceKm != null">{{ formatDistance(link.distanceKm) }}</span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { formatDistance } from '~~/shared/links'

defineProps<{
  title: string
  links: Array<{ href: string; text: string; distanceKm?: number | null }>
}>()
</script>

<style scoped>
ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 0.55rem 0;
  border-top: 1px solid var(--color-line);
}
span {
  color: var(--muted);
  font-size: var(--step--1);
}
</style>
