<template>
  <footer class="site-footer">
    <div class="frame inner">
      <div>
        <a
          href="/"
          class="mark"
          >K39</a
        >
        <p>Путеводитель по Калининградской области: места, маршруты и квесты.</p>
      </div>
      <nav aria-label="Разделы">
        <p class="label"> Разделы </p>
        <a
          v-for="link in hubs"
          :key="link.href"
          :href="link.href"
          >{{ link.text }}</a
        >
      </nav>
      <nav aria-label="Ещё">
        <p class="label"> Ещё </p>
        <a
          v-for="link in sections"
          :key="link.href"
          :href="link.href"
          >{{ link.text }}</a
        >
        <a
          v-for="link in legal"
          :key="link.href"
          :href="link.href"
          >{{ link.text }}</a
        >
      </nav>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { HUBS, LEGAL_LINKS, SECTION_LINKS } from '~~/shared/links'

const hubs = HUBS
const sections = SECTION_LINKS
const legal = LEGAL_LINKS
</script>

<style scoped>
.site-footer {
  margin-top: var(--space-7);
  background: var(--color-ink);
  color: var(--color-paper);
}
.inner {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-6) 0;
}
.mark {
  position: relative;
  display: inline-grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border: 2px solid var(--color-amber);
  border-radius: 50%;
  background: transparent;
  color: var(--color-amber);
  font-family: var(--font-display);
  font-size: 0.85rem;
  font-weight: 700;
  text-decoration: none;
}
.mark::after {
  content: '';
  position: absolute;
  inset: 3px;
  border: 1px dashed var(--color-amber);
  border-radius: 50%;
  opacity: 0.7;
}
p {
  max-width: 18rem;
  color: var(--color-footer-muted);
  font-size: var(--step--1);
}
.label {
  margin-bottom: 0.4rem;
  font-family: var(--font-stamp);
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
nav {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
a {
  color: var(--color-paper);
  text-decoration: none;
}
@media (min-width: 720px) {
  .inner {
    grid-template-columns: 1.4fr 1fr 1fr;
  }
}
</style>
