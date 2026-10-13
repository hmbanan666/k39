<template>
  <svg
    viewBox="0 0 16 16"
    aria-hidden="true"
  >
    <circle
      v-if="name === 'search'"
      cx="7"
      cy="7"
      r="4.2"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
    />
    <path
      v-if="name === 'search'"
      d="M10.2 10.2 L13.5 13.5"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
    />
    <path
      v-else-if="name === 'back'"
      d="M10 3.5 L5 8 l5 4.5"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      v-else-if="name === 'close'"
      d="M10 3.5 L5 8 l5 4.5"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      v-else
      d="M6 3.5 L11 8 l-5 4.5"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script setup lang="ts">
defineProps<{ name: 'search' | 'back' | 'open' | 'close' }>()
</script>

<style scoped>
svg {
  display: block;
  width: 1rem;
  height: 1rem;
}
</style>
