<template>
  <div
    class="host"
    aria-live="polite"
  >
    <p
      v-for="item in items"
      :key="item.id"
      class="toast"
      role="status"
      data-toast
    >
      {{ item.message }}
    </p>
  </div>
</template>

<script setup lang="ts">
const { items } = useToast()
</script>

<style scoped>
.host {
  position: fixed;
  z-index: 70;
  top: calc(var(--site-header-offset, 4.75rem) + 0.85rem);
  left: calc(50% + (var(--karta-panel, 0px) / 2));
  display: grid;
  gap: 0.4rem;
  width: min(20rem, calc(100vw - var(--karta-panel, 0px) - 5.5rem));
  pointer-events: none;
  transform: translateX(-50%);
}
.toast {
  margin: 0;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--color-line);
  border-left: 3px solid var(--color-brick);
  border-radius: 12px;
  background: var(--color-surface);
  box-shadow: var(--shadow-pop);
  color: var(--color-ink);
  font: 600 0.92rem/1.35 var(--font-body);
}
@media (max-width: 720px) {
  .host {
    right: 3.6rem;
    left: 0.75rem;
    width: auto;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .toast { transition: none; }
}
</style>
