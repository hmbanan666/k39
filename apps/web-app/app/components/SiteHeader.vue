<template>
  <header class="site-header">
    <a
      href="/"
      class="brand"
    >
      <span class="mark">K39</span>
      <span class="region">Калининградская область</span>
    </a>
    <nav
      class="desktop"
      aria-label="Разделы"
    >
      <a
        v-for="link in hubs"
        :key="link.href"
        :href="link.href"
      >{{ link.text }}</a>
      <a
        v-if="!loggedIn"
        href="/sign-in"
      >Войти</a>
      <a
        v-else
        href="/admin"
      >Админка</a>
    </nav>
    <div class="mobile">
      <UiDialog title="Разделы">
        <template #trigger>
          Меню
        </template>
        <nav
          class="sheet-nav"
          aria-label="Разделы"
        >
          <a
            v-for="link in hubs"
            :key="link.href"
            :href="link.href"
          >{{ link.text }}</a>
          <a
            v-if="!loggedIn"
            href="/sign-in"
          >Войти</a>
          <a
            v-else
            href="/admin"
          >Админка</a>
        </nav>
      </UiDialog>
    </div>
  </header>
</template>

<script setup lang="ts">
import { HUBS } from '~~/shared/links'

const { loggedIn } = useUserSession()
const hubs = HUBS
</script>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: var(--z-header);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: 0.7rem 1.25rem;
  border-bottom: 1px solid var(--color-line);
  background: rgb(255 251 243 / 94%);
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--text);
  text-decoration: none;
}
.mark {
  display: grid;
  width: 2.3rem;
  height: 2.3rem;
  place-items: center;
  border-radius: 50%;
  background: var(--color-brick);
  color: var(--color-surface);
  font-family: var(--font-stamp);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
}
.region {
  font-family: var(--font-stamp);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.desktop {
  display: none;
  flex-wrap: wrap;
  gap: 0.35rem 0.9rem;
  margin-left: auto;
}
.desktop a {
  color: var(--text);
  font-size: 0.95rem;
  text-decoration: none;
}
.sheet-nav { display: flex; flex-direction: column; gap: 0.8rem; margin: var(--space-4) 0; }
.sheet-nav a { color: var(--text); font-weight: 700; text-decoration: none; }
.mobile { margin-left: auto; }
@media (min-width: 900px) {
  .desktop { display: flex; }
  .mobile { display: none; }
}
@media (max-width: 520px) {
  .region { display: none; }
}
</style>
