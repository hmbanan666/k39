<template>
  <nav
    class="toc"
    :aria-labelledby="showLabel ? labelId : undefined"
    :aria-label="showLabel ? undefined : 'Содержание'"
  >
    <p
      v-if="showLabel"
      :id="labelId"
      class="toc-label"
    >
      Содержание
    </p>
    <ol>
      <li
        v-for="item in items"
        :key="item.id"
      >
        <a
          :href="`#${item.id}`"
          :aria-current="item.id === activeId ? 'location' : undefined"
        >{{ item.text }}</a>
        <ol
          v-if="item.children.length"
          class="sub"
        >
          <li
            v-for="child in item.children"
            :key="child.id"
          >
            <a
              :href="`#${child.id}`"
              :aria-current="child.id === activeId ? 'location' : undefined"
            >{{ child.text }}</a>
          </li>
        </ol>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import type { ReaderTocItem } from '~~/shared/reader-nav'

withDefaults(defineProps<{
  items: ReaderTocItem[]
  activeId?: string
  showLabel?: boolean
}>(), {
  activeId: '',
  showLabel: false,
})

const labelId = useId()
</script>

<style scoped>
.toc-label {
  margin: 0 0 0.65rem;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.2;
}
ol {
  margin: 0;
  padding: 0;
  list-style: none;
}
a {
  display: block;
  padding: 0.32rem 0 0.32rem 0.75rem;
  border-left: 2px solid var(--color-line);
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.35;
  text-decoration: none;
}
a:hover { color: var(--color-sea); }
a[aria-current="location"] {
  border-left-color: var(--color-brick);
  color: var(--color-ink);
  font-weight: 600;
}
.sub { margin: 0.05rem 0 0.15rem 0.7rem; }
.sub a { font-size: 0.86rem; }
</style>
