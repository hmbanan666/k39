<template>
  <header
    ref="headerRef"
    class="site-header"
  >
    <div class="frame bar">
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
          <small>{{ tagline }}</small>
        </span>
      </a>
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
          href="/map"
          :class="{ active: path === '/map' }"
        >Карта</a>
        <a
          v-if="!loggedIn"
          href="/sign-in"
          class="account"
          :class="{ active: path === '/sign-in' }"
        >Войти</a>
        <a
          v-else-if="isAdmin"
          href="/admin"
          class="account"
          :class="{ active: path.startsWith('/admin') }"
        >Админка</a>
      </nav>
    </div>
  </header>
</template>

<script setup lang="ts">
import { HUBS } from '~~/shared/links'

withDefaults(defineProps<{
  tagline?: string
}>(), {
  tagline: 'Калининградская область',
})

const route = useRoute()
const { loggedIn, user } = useUserSession()
const hubs = HUBS
const path = computed(() => route.path)
const isAdmin = computed(() => loggedIn.value && user.value?.role === 'admin')

// The tokens give the exact height for the usual layout. When the pill row
// wraps (narrow desktop with an extra admin link, zoomed text), the live
// height replaces it, so sticky offsets and anchor jumps stay correct.
const headerRef = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | undefined

function syncOffset() {
  const height = headerRef.value?.getBoundingClientRect().height
  if (height) {
    document.documentElement.style.setProperty('--site-header-offset', `${height}px`)
  }
}

onMounted(() => {
  syncOffset()
  if (headerRef.value && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(syncOffset)
    resizeObserver.observe(headerRef.value)
  }
})

onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: var(--z-header);
  border-bottom: var(--header-border) solid var(--color-line);
  background-color: var(--color-surface);
}
.bar {
  display: flex;
  align-items: center;
  gap: 2rem;
  min-height: var(--header-bar);
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
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
}
.account { margin-left: auto; }
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
  .bar {
    flex-wrap: wrap;
    gap: var(--header-row-gap) 0;
    min-height: 0;
    padding-bottom: var(--header-pad-bottom);
  }
  .logo {
    display: flex;
    align-items: center;
    height: var(--header-logo-row);
  }
  .logo-word { font-size: 1.3rem; }
  .logo-word small { display: none; }
  .nav {
    flex: 1 0 100%;
    flex-wrap: nowrap;
    gap: 0.5rem;
    overflow-x: auto;
  }
  .account { margin-left: 0; }
  .nav a {
    display: inline-flex;
    flex: none;
    align-items: center;
    height: var(--header-pill);
    padding: 0 0.75rem;
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
