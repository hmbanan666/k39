<template>
  <section
    class="module-text"
    :class="[module.variant]"
  >
    <h2 v-if="module.title">
      {{ module.title }}
    </h2>
    <ProseHtml
      class="prose"
      :html="module.html"
    />
  </section>
</template>

<script setup lang="ts">
import type { PublicPageModule } from '~~/shared/page-modules'

defineProps<{
  module: Extract<PublicPageModule, { type: 'text' }>
}>()
</script>

<style scoped>
h2 {
  margin: 0 0 0.8rem;
  font-family: var(--font-display);
  font-size: clamp(1.7rem, 1.3rem + 0.8vw, 2rem);
  letter-spacing: -0.02em;
}
.prose {
  max-width: 70ch;
}
.lead .prose {
  font-size: 1.08rem;
}
</style>
