<template>
  <aside class="offer">
    <p class="label">
      партнёр K39
    </p>
    <h2>{{ title }}</h2>
    <p>{{ terms }}</p>
    <a
      v-if="href"
      :href="href"
    >{{ anchor || title }}</a>
  </aside>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  terms: string
  href?: string
  anchor?: string
}>()
</script>

<style scoped>
.offer {
  margin: 0;
  padding: var(--space-4);
  border: 1.5px dashed var(--color-amber);
  border-radius: 16px;
  background: var(--color-amber-soft);
}
.label {
  margin: 0 0 var(--space-2);
  color: var(--color-partner);
  font-family: var(--font-stamp);
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
h2 { margin-top: 0; font-size: var(--step-1); }
</style>
