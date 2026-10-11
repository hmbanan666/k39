<template>
  <div
    v-if="!decided"
    class="consent"
    role="dialog"
    aria-label="Аналитика"
  >
    <p>
      Можно записать, какое место вы открыли, без имени и почты.
      <UiLink href="/legal/privacy-policy">
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
const { decided, grant, deny } = useConsent()
</script>

<style scoped>
.consent {
  position: fixed;
  z-index: var(--z-consent);
  bottom: 12px;
  left: 12px;
  width: min(20rem, calc(100% - 24px));
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  background: var(--color-surface);
  box-shadow: var(--shadow-pop);
}
p { margin: 0 0 0.55rem; font-size: var(--step--1); }
.actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
</style>
