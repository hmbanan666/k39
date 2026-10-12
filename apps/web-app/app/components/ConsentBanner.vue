<template>
  <div
    v-if="enabled && !decided"
    class="consent"
    role="dialog"
    aria-label="Аналитика"
  >
    <p>
      Можно запомнить браузер случайным cookie, без имени и почты. Без согласия остаётся суточный обезличенный счётчик, без cookie и без IP.
      <UiLink href="/privacy">
        Подробнее
      </UiLink>
    </p>
    <div class="actions">
      <UiButton @click="grant">
        Разрешить
      </UiButton>
      <UiButton
        variant="quiet"
        @click="deny"
      >
        Не записывать
      </UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
const enabled = computed(() => useRuntimeConfig().public.consentBanner)
const { decided, grant, deny } = useConsent()
</script>

<style scoped>
.consent {
  position: fixed;
  z-index: var(--z-consent);
  bottom: 1rem;
  left: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem 0.85rem;
  align-items: center;
  width: min(26rem, calc(100% - 2rem));
  padding: 0.7rem 0.85rem;
  border: 1px solid #5a4c42;
  border-radius: 14px;
  background: var(--color-ink);
  color: #f1e8d9;
  font-size: 0.82rem;
  line-height: 1.4;
  box-shadow: 0 12px 30px -10px rgb(0 0 0 / 40%);
}
p { margin: 0; flex: 1 1 12rem; }
.consent :deep(a) { color: var(--color-amber-soft); }
.actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.consent :deep(.btn) {
  min-height: 2rem;
  padding: 0 0.7rem;
  font-size: 0.82rem;
}
.consent :deep(.btn-primary) {
  border-color: var(--color-amber);
  background: var(--color-amber);
  color: var(--color-ink);
  box-shadow: none;
}
.consent :deep(.btn-quiet) {
  border-color: #8a7568;
  background: transparent;
  color: #f1e8d9;
}
@media (max-width: 720px) {
  .consent {
    right: 0;
    bottom: 0;
    left: 0;
    width: auto;
    padding: 0.4rem 0.7rem;
    border-width: 1px 0 0;
    border-radius: 0;
    font-size: 0.75rem;
    gap: 0.4rem 0.6rem;
  }
  p { flex-basis: 8rem; }
  .consent :deep(.btn) { min-height: 1.8rem; padding: 0 0.55rem; font-size: 0.75rem; }
}
</style>
