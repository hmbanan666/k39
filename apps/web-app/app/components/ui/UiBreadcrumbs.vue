<template>
  <nav
    v-if="crumbs.length"
    aria-label="Хлебные крошки"
  >
    <ol>
      <li
        v-for="(crumb, index) in crumbs"
        :key="crumb.href"
      >
        <a
          v-if="index < crumbs.length - 1"
          :href="crumb.href"
          >{{ crumb.name }}</a
        >
        <span v-else>{{ crumb.name }}</span>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import type { Crumb } from '~~/shared/seo'

defineProps<{ crumbs: Crumb[] }>()
</script>

<style scoped>
ol {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.55rem;
  margin: 0 0 var(--space-4);
  padding: 0;
  list-style: none;
  color: var(--muted);
  font-size: var(--step--1);
}
li:not(:last-child)::after {
  content: '/';
  margin-left: 0.55rem;
  color: var(--color-line);
}
</style>
