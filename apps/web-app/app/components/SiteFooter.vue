<template>
  <footer class="site-footer">
    <div class="inner">
      <div>
        <a
          href="/"
          class="mark"
        >K39</a>
        <p>Путеводитель по Калининградской области: места, маршруты и квесты.</p>
      </div>
      <nav aria-label="Разделы">
        <p class="label">
          Разделы
        </p>
        <a
          v-for="link in hubs"
          :key="link.href"
          :href="link.href"
        >{{ link.text }}</a>
      </nav>
      <nav aria-label="Ещё">
        <p class="label">
          Ещё
        </p>
        <a
          v-for="link in sections"
          :key="link.href"
          :href="link.href"
        >{{ link.text }}</a>
        <a href="/legal/privacy-policy">Конфиденциальность</a>
      </nav>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { HUBS, SECTION_LINKS } from '~~/shared/links'

const hubs = HUBS
const sections = SECTION_LINKS
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
  width: min(var(--wide), calc(100% - 2rem));
  margin: 0 auto;
  padding: var(--space-6) 0;
}
.mark {
  display: inline-grid;
  width: 2.4rem;
  height: 2.4rem;
  place-items: center;
  border-radius: 50%;
  background: var(--color-brick);
  color: var(--color-surface);
  font-family: var(--font-stamp);
  font-size: 0.75rem;
  text-decoration: none;
}
p { max-width: 18rem; color: #e7dccb; font-size: var(--step--1); }
.label {
  margin-bottom: 0.4rem;
  font-family: var(--font-stamp);
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
nav { display: flex; flex-direction: column; gap: 0.35rem; }
a { color: var(--color-paper); text-decoration: none; }
@media (min-width: 720px) {
  .inner { grid-template-columns: 1.4fr 1fr 1fr; }
}
</style>
