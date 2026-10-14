<template>
  <div
    v-if="visible"
    ref="root"
    class="notice"
    role="region"
    aria-label="Уведомление о cookie"
  >
    <Sticker
      slug="with-blank-sign"
      :width="52"
      decorative
      aria-hidden="true"
      class="notice-sticker"
    />
    <p>
      Мы используем cookie, чтобы сайт работал корректно.
      <NuxtLink to="/privacy">
        Подробнее
      </NuxtLink>
    </p>
    <button
      type="button"
      @click="dismiss"
    >
      Хорошо
    </button>
  </div>
</template>

<script setup lang="ts">
const STORAGE_KEY = 'k39_cookie_notice'
const visible = ref(false)
const root = ref<HTMLElement | null>(null)

let observer: ResizeObserver | undefined

function publishOffset() {
  const el = root.value
  if (!visible.value || !el?.isConnected) {
    document.documentElement.style.removeProperty('--cookie-notice-offset')
    return
  }
  // offsetHeight ignores the enter transform, so the map panel clears the settled card.
  const bottom = Number.parseFloat(getComputedStyle(el).bottom) || 0
  const gap = Math.ceil(el.offsetHeight + bottom)
  document.documentElement.style.setProperty('--cookie-notice-offset', `${Math.max(gap, 0)}px`)
}

onMounted(() => {
  try {
    visible.value = localStorage.getItem(STORAGE_KEY) !== '1'
  } catch {
    visible.value = true
  }
  nextTick(() => {
    publishOffset()
    const el = root.value
    if (el && 'ResizeObserver' in window) {
      observer = new ResizeObserver(() => publishOffset())
      observer.observe(el)
    }
  })
  window.addEventListener('resize', publishOffset)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('resize', publishOffset)
  document.documentElement.style.removeProperty('--cookie-notice-offset')
})

function dismiss() {
  visible.value = false
  document.documentElement.style.removeProperty('--cookie-notice-offset')
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // A private browser can refuse storage. Hiding the card is enough.
  }
}
</script>

<style scoped>
.notice {
  position: fixed;
  z-index: var(--z-consent);
  right: auto;
  bottom: max(12px, env(safe-area-inset-bottom));
  left: max(12px, env(safe-area-inset-left));
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
  width: min(26.25rem, calc(100vw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
  max-width: 26.25rem;
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-ink);
  /* The bar floats 12 px above the screen edge, so the shadow must fit in that gap or it gets cut off. */
  box-shadow: 0 2px 10px rgb(43 36 32 / 12%);
  font-family: var(--font-body);
  font-size: var(--step--1);
  line-height: 1.35;
  animation: notice-in var(--duration) var(--ease);
}
.notice-sticker {
  flex: none;
  width: 3.25rem;
}
p {
  flex: 1 1 12rem;
  margin: 0;
}
a {
  color: var(--color-sea);
  font-weight: 700;
  text-underline-offset: 0.12em;
}
button {
  flex: none;
  min-height: 2.5rem;
  padding: 0 0.95rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--color-brick);
  color: var(--color-surface);
  font: 700 0.875rem/1 var(--font-body);
  cursor: pointer;
}
button:hover { background: var(--color-brick-dark); }
@keyframes notice-in {
  from {
    opacity: 0;
    transform: translateY(0.6rem);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (max-width: 720px) {
  .notice {
    right: max(12px, env(safe-area-inset-right));
    width: auto;
    flex-wrap: nowrap;
    max-width: none;
  }
  .notice-sticker { width: 2.75rem; }
  p {
    flex: 1 1 0;
    min-width: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .notice { animation: none; }
}
</style>

<style>
html:has([aria-label="Уведомление о cookie"]) {
  --cookie-notice-offset: calc(7.5rem + env(safe-area-inset-bottom, 0px));
}
@media (min-width: 721px) {
  html:has([aria-label="Уведомление о cookie"]) {
    --cookie-notice-offset: 5.75rem;
  }
}
</style>
