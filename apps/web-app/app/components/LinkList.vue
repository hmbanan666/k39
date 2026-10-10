<template>
  <section v-if="links.length">
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

defineProps<{ title: string, links: TextLink[] }>()
</script>
