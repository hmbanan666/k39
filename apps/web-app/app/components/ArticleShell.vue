<template>
  <article class="doc">
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
          >{{ crumb.name }}</a>
          <span v-else>{{ crumb.name }}</span>
        </li>
      </ol>
    </nav>
    <h1>{{ h1 }}</h1>
    <slot />
  </article>
</template>

<script setup lang="ts">
import type { Crumb } from '~~/shared/seo'

defineProps<{ h1: string, crumbs: Crumb[] }>()
</script>

<style scoped>
.doc { max-width: 42rem; margin: 0 auto; padding: 1.5rem 1.25rem 4rem; }
ol { display: flex; flex-wrap: wrap; gap: 0.35rem 0.6rem; padding: 0; list-style: none; font-size: 0.9rem; }
h1 { font-family: "K39 Display", Georgia, serif; font-size: 2.1rem; line-height: 1.15; }
</style>
