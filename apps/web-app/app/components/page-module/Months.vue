<template>
  <nav
    class="months"
    :aria-label="title || 'Месяцы'"
  >
    <h2 v-if="title">
      {{ title }}
    </h2>
    <ul ref="listRef">
      <li
        v-for="month in months"
        :key="month.href"
      >
        <span
          v-if="month.current"
          aria-current="page"
          class="current"
        >{{ month.text }}</span>
        <a
          v-else
          :href="month.href"
        >{{ month.text }}</a>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
  months: { href: string, text: string, current: boolean }[]
}>()

// On a phone the row scrolls; start it at the current month.
const listRef = ref<HTMLElement | null>(null)
onMounted(() => {
  const list = listRef.value
  const current = list?.querySelector<HTMLElement>('[aria-current="page"]')
  if (list && current && list.scrollWidth > list.clientWidth) {
    list.scrollLeft = current.offsetLeft - (list.clientWidth - current.offsetWidth) / 2
  }
})
</script>

<style scoped>
h2 {
  margin: 0 0 0.6rem;
  font-family: var(--font-display);
  font-size: 1.25rem;
}
ul {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
a, .current {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  padding: 0.15rem 0.75rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--text);
  font-size: 0.9rem;
  text-decoration: none;
}
a:hover {
  border-color: var(--color-brick);
  color: var(--color-brick);
}
/* One scrollable row on phones, like the header pills, so twelve months
   do not push the lead below the first screen. */
@media (max-width: 899px) {
  ul {
    flex-wrap: nowrap;
    margin-inline: calc(-1 * var(--frame-pad));
    padding-inline: var(--frame-pad);
    overflow-x: auto;
    scrollbar-width: none;
  }
  li { flex: none; }
}
.current {
  border-color: var(--color-brick);
  background: var(--color-brick);
  color: #fff;
  font-weight: 600;
}
</style>
