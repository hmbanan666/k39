<template>
  <header class="site-header">
    <div class="in">
      <a
        href="/"
        class="logo"
      >
        <picture class="logo-mark">
          <source
            type="image/webp"
            srcset="/logo/moose-head.webp 1x, /logo/moose-head@2x.webp 2x"
          >
          <source
            type="image/png"
            srcset="/logo/moose-head.png 1x, /logo/moose-head@2x.png 2x"
          >
          <img
            src="/logo/moose-head.png"
            alt=""
            width="108"
            height="96"
          >
        </picture>
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
  background-color: var(--color-surface);
}
.logo {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: inherit;
  text-decoration: none;
}
.logo-mark {
  display: block;
  flex: none;
  height: 40px;
}
.logo-mark img {
  display: block;
  width: auto;
  height: 40px;
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
@media (min-width: 900px) {
  .logo-mark,
  .logo-mark img {
    height: 48px;
  }
}
</style>
