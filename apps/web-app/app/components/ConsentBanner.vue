<template>
  <div
    v-if="!decided"
    class="consent"
  >
    <p>
      Можно записать обезличенные события: какое место вы открыли, без имени и почты.
      Идентификатор сессии появится только после согласия. Это требование 152-ФЗ.
      <NuxtLink to="/legal/privacy-policy">
        Политика
      </NuxtLink>
    </p>
    <div class="actions">
      <button
        type="button"
        @click="grant"
      >
        Разрешить аналитику
      </button>
      <button
        type="button"
        class="quiet"
        @click="deny"
      >
        Не записывать
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const { decided, grant, deny } = useConsent()
</script>

<style scoped>
.consent {
  position: fixed;
  z-index: 70;
  left: 12px;
  right: 12px;
  bottom: 12px;
  max-width: 40rem;
  margin: 0 auto;
  padding: 0.9rem 1rem;
  background: #fbf6ec;
  color: #3a2e24;
  border: 1.5px solid #3a2e24;
  border-radius: 10px;
  box-shadow: 3px 3px 0 rgba(58, 46, 36, 0.25);
}
.actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
button { border: 1.4px solid #3a2e24; background: #9b3d2a; color: #fbf3e2; border-radius: 999px; padding: 0.45rem 0.8rem; font-weight: 700; cursor: pointer; }
button.quiet { background: transparent; color: #3a2e24; }
</style>
