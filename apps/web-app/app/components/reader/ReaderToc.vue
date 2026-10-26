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
    <div
      v-if="progress !== null"
      class="progress"
      role="progressbar"
      aria-label="Прочитано"
      :aria-valuenow="Math.round(progress * 100)"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <span :style="{ transform: `scaleX(${progress})` }" />
    </div>
    <ol>
      <li
        v-for="item in items"
        :key="item.id"
      >
        <a
          :href="`#${item.id}`"
          :aria-current="item.id === activeId ? 'location' : undefined"
          >{{ item.text }}</a
        >
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
              >{{ child.text }}</a
            >
          </li>
        </ol>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import type { ReaderTocItem } from '~~/shared/reader-nav'

withDefaults(
  defineProps<{
    items: ReaderTocItem[]
    activeId?: string
    showLabel?: boolean
    /** Reading progress 0..1 for the rail; null hides the bar. */
    progress?: number | null
  }>(),
  {
    activeId: '',
    showLabel: false,
    progress: null,
  },
)

const labelId = useId()
</script>

<style scoped>
.toc-label {
  margin: 0 0 0.6rem;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.2;
}
.progress {
  height: 3px;
  margin: 0 0 0.75rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-line);
}
.progress span {
  display: block;
  height: 100%;
  background: var(--color-brick);
  transform-origin: left center;
  transition: transform 120ms linear;
}
ol {
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: toc;
}
li {
  counter-increment: toc;
}
a {
  display: grid;
  grid-template-columns: 1.6rem 1fr;
  gap: 0.15rem;
  padding: 0.38rem 0.5rem 0.38rem 0.4rem;
  border-left: 3px solid transparent;
  border-radius: 0 8px 8px 0;
  color: var(--color-ink);
  font-size: 0.93rem;
  line-height: 1.35;
  text-decoration: none;
  transition:
    background-color var(--duration-fast),
    border-color var(--duration-fast);
}
a::before {
  content: counter(toc, decimal-leading-zero);
  color: var(--muted);
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  line-height: 1.75;
}
a:hover {
  background: var(--color-sand);
}
a:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}
a[aria-current='location'] {
  border-left-color: var(--color-brick);
  background: color-mix(in srgb, var(--color-brick) 10%, transparent);
  color: var(--color-brick);
  font-weight: 700;
}
a[aria-current='location']::before {
  color: var(--color-brick);
}
.sub {
  margin: 0.05rem 0 0.2rem 1.6rem;
  counter-reset: none;
}
.sub li {
  counter-increment: none;
}
.sub a {
  display: block;
  font-size: 0.86rem;
  color: var(--muted);
}
.sub a::before {
  content: none;
}
.sub a[aria-current='location'] {
  color: var(--color-brick);
}
</style>
