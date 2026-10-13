<template>
  <section
    v-if="items.length"
    class="eat"
  >
    <h2>Где поесть рядом</h2>
    <ul>
      <li
        v-for="item in items"
        :key="item.href"
      >
        <a
          :href="item.href"
          data-track="outbound"
          data-track-name="venue"
        >
          <span
            v-if="item.partner"
            class="partner"
          >Партнёр</span>
          <span class="name">{{ item.name }}</span>
          <span class="kind">{{ item.kindLabel }}</span>
        </a>
        <span class="meta">
          <span>{{ item.distance }}</span>
          <span
            v-if="item.stale"
            class="stale"
          >Давно не проверяли</span>
        </span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { PublicMedia } from '~~/shared/media'

const props = defineProps<{
  items: Array<{
    href: string
    slug: string
    name: string
    kindLabel: string
    distance: string
    partner: boolean
    stale: boolean
    media?: PublicMedia | null
  }>
}>()

onMounted(() => {
  if (!props.items.length || typeof window === 'undefined') {
    return
  }
  for (const item of props.items) {
    window.dispatchEvent(new CustomEvent('k39-track', {
      detail: { type: 'impression', target: item.href },
    }))
  }
})
</script>

<style scoped>
.eat { margin-top: 3rem; }
h2 { margin-bottom: 1rem; }
ul { margin: 0; padding: 0; list-style: none; }
li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  align-items: baseline;
  padding: 0.7rem 0;
  border-top: 1px solid var(--color-line);
}
a { color: inherit; text-decoration: none; }
.name { font-weight: 700; }
.kind { margin-left: 0.5rem; color: var(--muted); font-size: var(--step--1); }
.meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  color: var(--muted);
  font-size: var(--step--1);
  white-space: nowrap;
}
.partner {
  display: inline-block;
  margin-right: 0.45rem;
  padding: 0.05rem 0.4rem;
  border-radius: 3px;
  background: var(--color-amber-soft);
  color: var(--color-partner);
  font-family: "Alegreya SC", serif;
  font-size: var(--step--1);
}
.stale { color: var(--color-warn); }
@media (max-width: 640px) {
  li { align-items: flex-start; }
}
</style>
