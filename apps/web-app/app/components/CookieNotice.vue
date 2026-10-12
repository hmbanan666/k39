<template>
  <div
    v-if="visible"
    class="notice"
    role="region"
    aria-label="Уведомление о cookie"
  >
    <p>
      Мы используем cookie, чтобы сайт работал удобнее. Продолжая пользоваться сайтом, вы соглашаетесь с
      <NuxtLink to="/privacy">
        Политикой конфиденциальности
      </NuxtLink>
      и
      <NuxtLink to="/cookies">
        правилами использования cookie
      </NuxtLink>.
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

onMounted(() => {
  try {
    visible.value = localStorage.getItem(STORAGE_KEY) !== '1'
  } catch {
    visible.value = true
  }
})

function dismiss() {
  visible.value = false
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // A private browser can refuse storage. Hiding the bar is enough.
  }
}
</script>

<style scoped>
.notice {
  position: fixed;
  z-index: var(--z-consent);
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  height: 56px;
  max-height: 56px;
  padding: 0 1rem 0 1.1rem;
  background: var(--color-ink);
  color: var(--color-paper);
  font-family: var(--font-body);
  font-size: 0.8125rem;
  line-height: 1.25;
}
p { margin: 0; }
a {
  color: var(--color-amber-soft);
  font-weight: 700;
  text-underline-offset: 0.12em;
}
button {
  flex: none;
  height: 2rem;
  padding: 0 0.85rem;
  border: 0;
  border-radius: 8px;
  background: var(--color-brick);
  color: var(--color-paper);
  font-family: var(--font-body);
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
}
button:hover { background: var(--color-brick-dark); }
@media (max-width: 720px) {
  .notice {
    height: auto;
    max-height: none;
    align-items: center;
    padding: 0.35rem 0.65rem;
    font-size: 0.6875rem;
    line-height: 1.3;
  }
  p { flex: 1 1 11rem; }
  button { height: 1.65rem; padding: 0 0.65rem; font-size: 0.6875rem; }
}
</style>
