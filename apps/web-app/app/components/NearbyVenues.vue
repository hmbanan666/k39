<template>
  <section
    v-if="items.length"
    ref="root"
    class="nearby-venues"
  >
    <h2>Где поесть рядом</h2>
    <ul>
      <li
        v-for="item in items"
        :key="item.slug"
        :data-venue="item.slug"
      >
        <a :href="item.href">{{ item.name }}</a>
        <span class="meta">
          <UiBadge
            v-if="item.partner"
            tone="amber"
          >
            Партнёр
          </UiBadge>
          {{ item.kindLabel }}
          <span v-if="item.distanceLabel">{{ item.distanceLabel }}</span>
        </span>
        <small v-if="item.stale">Давно не проверяли</small>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  items: Array<{
    slug: string
    href: string
    name: string
    kindLabel: string
    distanceLabel: string
    partner: boolean
    stale: boolean
  }>
}>()

const root = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  const node = root.value
  if (!node || typeof IntersectionObserver === 'undefined') {
    return
  }
  const seen = new Set<string>()
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) {
        continue
      }
      const slug = (entry.target as HTMLElement).dataset.venue
      if (!slug || seen.has(slug)) {
        continue
      }
      seen.add(slug)
      window.dispatchEvent(new CustomEvent('k39-track', {
        detail: { type: 'impression', target: `venue:${slug}` },
      }))
      observer?.unobserve(entry.target)
    }
  }, { threshold: 0.5 })
  for (const card of node.querySelectorAll('[data-venue]')) {
    observer.observe(card)
  }
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
ul { margin: 0; padding: 0; list-style: none; }
li {
  display: grid;
  gap: 0.15rem;
  padding: 0.7rem 0;
  border-top: 1px solid var(--color-line);
}
a { color: var(--color-ink); font-weight: 700; text-decoration: none; }
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.6rem;
  align-items: center;
  color: var(--muted);
  font-size: var(--step--1);
}
small { color: var(--muted); }
</style>
