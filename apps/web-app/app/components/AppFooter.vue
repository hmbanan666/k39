<template>
  <footer class="site-footer">
    <nav aria-label="Разделы">
      <a
        v-for="link in links"
        :key="link.href"
        :href="link.href"
      >{{ link.text }}</a>
    </nav>
    <p>K39, места Калининградской области.</p>
  </footer>
</template>

<script setup lang="ts">
import { HUBS, SECTION_LINKS } from '~~/shared/links'

const links = [...HUBS, ...SECTION_LINKS, { href: '/legal/privacy-policy', text: 'Политика конфиденциальности' }]
</script>

<style scoped>
.site-footer { padding: 1.5rem 1.25rem 5rem; color: #6b5a48; }
nav { display: flex; flex-wrap: wrap; gap: 0.75rem 1rem; margin-bottom: 0.6rem; }
a { color: inherit; }
</style>
