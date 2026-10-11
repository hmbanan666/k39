<template>
  <header class="site-header">
    <div class="in">
      <a
        href="/"
        class="logo"
      >
        <span class="logo-mark">K39</span>
        <span class="logo-word">
          K39
          <small>Калининградская область</small>
        </span>
      </a>
    </div>
    <nav
      class="nav"
      aria-label="Разделы"
    >
      <a
        v-for="link in hubs"
        :key="link.href"
        :href="link.href"
        :class="{ active: path === link.href }"
      >{{ link.text }}</a>
      <a
        v-if="!loggedIn"
        href="/sign-in"
        :class="{ active: path === '/sign-in' }"
      >Войти</a>
      <a
        v-else-if="isAdmin"
        href="/admin"
        :class="{ active: path.startsWith('/admin') }"
      >Админка</a>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { HUBS } from '~~/shared/links'

const route = useRoute()
const { loggedIn, user } = useUserSession()
const hubs = HUBS
const path = computed(() => route.path)
const isAdmin = computed(() => loggedIn.value && user.value?.role === 'admin')
</script>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: var(--z-header);
  display: flex;
  align-items: center;
  gap: 2rem;
  min-height: 72px;
  padding: 0 1.25rem;
  border-bottom: 1px solid var(--color-line);
  background: rgb(255 251 243 / 92%);
}
.logo {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: inherit;
  text-decoration: none;
}
.logo-mark {
  position: relative;
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 2px solid var(--color-brick);
  border-radius: 50%;
  color: var(--color-brick);
  font: 700 17px/1 var(--font-display);
}
.logo-mark::after {
  content: "";
  position: absolute;
  inset: 3px;
  border: 1px dashed var(--color-brick);
  border-radius: 50%;
  opacity: 0.55;
}
.logo-word {
  color: var(--text);
  font: 700 1.5rem/1 var(--font-display);
}
.logo-word small {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font: 500 11px/1.2 var(--font-body);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.nav a {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  color: var(--text);
  font: 500 0.95rem/1 var(--font-body);
  text-decoration: none;
}
.nav a.active {
  background: rgb(163 64 42 / 8%);
  color: var(--color-brick);
}
@media (max-width: 899px) {
  .site-header {
    display: block;
    padding: 0;
  }
  .in {
    display: flex;
    align-items: center;
    height: 60px;
    padding: 0 1rem;
  }
  .logo-mark { width: 38px; height: 38px; font-size: 15px; }
  .logo-word { font-size: 1.3rem; }
  .logo-word small { display: none; }
  .nav {
    flex-wrap: nowrap;
    gap: 0.5rem;
    overflow-x: auto;
    padding: 0 1rem 0.7rem;
  }
  .nav a {
    flex: none;
    padding: 0.45rem 0.75rem;
    border: 1px solid var(--color-line);
    border-radius: 999px;
    background: var(--color-surface);
    font-size: 0.875rem;
  }
  .nav a.active {
    border-color: var(--color-brick);
    background: var(--color-brick);
    color: #fff;
  }
}
</style>
