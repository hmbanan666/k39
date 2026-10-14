<template>
  <nav
    class="section-bar"
    :class="{ shown: visible }"
    aria-label="Разделы страницы"
    :aria-hidden="visible ? undefined : 'true'"
  >
    <ol ref="listRef">
      <li
        v-for="(item, index) in items"
        :key="item.id"
      >
        <a
          :href="`#${item.id}`"
          :tabindex="visible ? undefined : -1"
          :aria-current="item.id === current ? 'location' : undefined"
        ><span class="num">{{ String(index + 1).padStart(2, '0') }}</span>{{ item.text }}</a>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import type { ReaderTocItem } from '~~/shared/reader-nav'

// Compact section chips under the site header, for the part of the page the
// rail no longer reaches. Same items and active state as the contents.
const props = defineProps<{
  items: ReaderTocItem[]
  activeId: string
  visible: boolean
}>()

const listRef = ref<HTMLElement | null>(null)
const current = computed(() => props.items.find((item) => item.id === props.activeId || item.children.some((child) => child.id === props.activeId))?.id ?? '')

watch([current, () => props.visible], async () => {
  await nextTick()
  const list = listRef.value
  const link = list?.querySelector<HTMLElement>('[aria-current]')
  if (list && link && props.visible) {
    list.scrollTo({ left: link.offsetLeft - 16, behavior: 'smooth' })
  }
})
</script>

<style scoped>
.section-bar {
  position: fixed;
  top: var(--site-header-offset);
  right: 0;
  left: 0;
  z-index: 20;
  border-bottom: 1px solid var(--color-line);
  background: var(--color-surface);
  box-shadow: 0 2px 6px rgb(43 36 32 / 6%);
  transform: translateY(-110%);
  visibility: hidden;
  transition: transform 0.18s ease, visibility 0.18s;
}
.section-bar.shown {
  transform: none;
  visibility: visible;
}
ol {
  display: flex;
  gap: 0.4rem;
  margin: 0 auto;
  padding: 0.5rem 1rem;
  max-width: var(--content-max, 1200px);
  overflow-x: auto;
  list-style: none;
  scrollbar-width: none;
}
li { flex: none; }
a {
  display: inline-flex;
  gap: 0.35rem;
  align-items: baseline;
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  color: var(--color-ink);
  font-size: 0.875rem;
  line-height: 1.3;
  text-decoration: none;
  white-space: nowrap;
}
a:hover { background: var(--color-sand, var(--bg)); }
.num {
  color: var(--color-muted, currentColor);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}
a[aria-current] {
  border-color: var(--color-brick);
  background: color-mix(in srgb, var(--color-brick) 10%, transparent);
  color: var(--color-brick);
  font-weight: 600;
}
@media (prefers-reduced-motion: reduce) {
  .section-bar { transition: none; }
}
</style>
