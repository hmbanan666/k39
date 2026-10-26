<template>
  <section
    v-if="links.length"
    class="links"
  >
    <h2>{{ title }}</h2>
    <ul>
      <li
        v-for="link in links"
        :key="link.href + link.text"
      >
        <a :href="link.href">{{ link.text }}</a>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { TextLink } from '~~/shared/links'

defineProps<{ title: string; links: TextLink[] }>()
</script>

<style scoped>
ul {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
a {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  padding: 0.15rem 0.75rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 600;
  text-decoration: none;
}
a:hover {
  border-color: var(--color-brick);
  color: var(--color-brick);
}
</style>
