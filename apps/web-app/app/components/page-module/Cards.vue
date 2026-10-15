<template>
  <section class="module-cards" :class="[module.type]">
    <h2>{{ module.title }}</h2>
    <ol class="cards">
      <li
        v-for="entry in ranked"
        :key="entry.item.title"
        class="card"
        :class="[{ fits: fitsPicker(entry.fit) }]"
      >
        <h3>{{ entry.item.title }}</h3>
        <span
          v-if="fitsPicker(entry.fit)"
          class="badge"
        >Под ваш выбор</span>
        <ProseHtml
          class="prose"
          :html="entry.item.html"
        />
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import type { PickerState, PublicPageModule } from '~~/shared/page-modules'
import { fitsPicker, rankByPicker } from '~~/shared/page-modules'

const props = defineProps<{
  module: Extract<PublicPageModule, { type: 'ideas' | 'plans' }>
  state: PickerState
}>()

const ranked = computed(() => rankByPicker(props.module.items, (item) => item.tags, props.state))
</script>

<style scoped>
h2 {
  margin: 0 0 0.8rem;
  font-family: var(--font-display);
  font-size: clamp(1.7rem, 1.3rem + 0.8vw, 2rem);
  letter-spacing: -0.02em;
}
.cards {
  display: grid;
  gap: 0.8rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.card {
  display: grid;
  align-content: start;
  gap: 0.3rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--color-line);
  border-radius: 8px;
  background: var(--color-surface);
}
.card.fits { border-color: var(--color-brick); }
h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.3rem;
}
.badge {
  justify-self: start;
  padding: 0.1rem 0.55rem;
  border-radius: 999px;
  background: rgb(163 64 42 / 10%);
  color: var(--color-brick);
  font-size: 0.78rem;
  font-weight: 700;
}
.card .prose :deep(p) { margin: 0.3rem 0 0; }
@media (min-width: 900px) {
  .ideas .cards { grid-template-columns: 1fr 1fr; }
}
</style>
