<template>
  <header class="postcard">
    <UiBreadcrumbs :crumbs="crumbs" />
    <p
      v-if="kicker"
      class="kicker"
    >
      {{ kicker }}
    </p>
    <h1>{{ h1 }}</h1>
    <p
      v-if="lede"
      class="lede"
    >
      {{ lede }}
    </p>
    <div
      v-if="$slots.default"
      class="extra"
    >
      <slot />
    </div>
    <span
      class="postmark"
      aria-hidden="true"
    >K39</span>
  </header>
</template>

<script setup lang="ts">
import type { Crumb } from '~~/shared/seo'

withDefaults(defineProps<{
  h1: string
  crumbs?: Crumb[]
  kicker?: string
  lede?: string
}>(), {
  crumbs: () => [],
  kicker: '',
  lede: '',
})
</script>

<style scoped>
.postcard {
  position: relative;
  margin-bottom: var(--space-6);
  padding: var(--space-5) var(--space-5) var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(180deg, rgb(255 250 242 / 96%), var(--surface)),
    var(--surface);
  box-shadow: var(--shadow-card);
}
.postcard::before {
  content: "";
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: -7px;
  width: 14px;
  background: radial-gradient(circle, var(--bg) 3.5px, transparent 4px);
  background-size: 14px 18px;
  background-position: center;
}
.kicker {
  margin: 0 0 var(--space-2);
  color: var(--color-brick);
  font-size: var(--step--1);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.lede { max-width: 38rem; color: var(--muted); }
.postmark {
  position: absolute;
  top: 1.1rem;
  right: 1rem;
  display: grid;
  width: 4.4rem;
  height: 4.4rem;
  place-items: center;
  border: 2px solid var(--color-brick);
  border-radius: 50%;
  color: var(--color-brick);
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: 0.08em;
  transform: rotate(12deg);
  opacity: 0.8;
  pointer-events: none;
}
@media (max-width: 720px) {
  .postcard { padding-top: var(--space-4); }
  .postmark {
    position: static;
    margin-top: var(--space-3);
  }
  h1 { padding-right: 0; }
}
@media (min-width: 721px) {
  h1 { padding-right: 5rem; }
}
</style>
