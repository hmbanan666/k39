<template>
  <svg
    class="glyph"
    viewBox="0 0 16 16"
    aria-hidden="true"
  >
    <path
      v-if="name === 'forty'"
      d="M2 6h2V3h2v3h2V3h2v3h2V3h2v3h2v8H2z"
    />
    <path
      v-else-if="name === 'zamki'"
      d="M3 14V8h2V5h2v3h2V5h2v3h2V8h2v6z"
    />
    <path
      v-else-if="name === 'plyazhi'"
      d="M1 10c1.5-2 2.5-2 4 0s2.5 2 4 0 2.5-2 4 0 2.5 2 2 0"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
    />
    <path
      v-else-if="name === 'muzei'"
      d="M2 6 L8 2 L14 6 V7 H2z M3 8h2v5H3z M7 8h2v5H7z M11 8h2v5h-2z M2 13h12v1.4H2z"
    />
    <path
      v-else-if="name === 'tserkvi'"
      d="M7 1h2v4h4v2H9v8H7V7H3V5h4z"
    />
    <path
      v-else-if="name === 'kurorty'"
      d="M8 5.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6z M8 1.2v2 M8 12.8v2 M1.2 8h2 M12.8 8h2 M3 3l1.4 1.4 M11.6 11.6 13 13 M13 3l-1.4 1.4 M4.4 11.6 3 13"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linecap="round"
    />
    <path
      v-else-if="name === 'coffee' || name === 'cafe' || name === 'other'"
      d="M3 4h8v5a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z M11 5h1.5a2 2 0 0 1 0 4H11"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
    />
    <path
      v-else-if="name === 'restaurant' || name === 'eda'"
      d="M2 8h12M3.2 8a4.8 2.6 0 1 0 9.6 0 4.8 2.6 0 1 0-9.6 0"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linecap="round"
    />
    <path
      v-else-if="name === 'bakery'"
      d="M3 10c0-4 2.2-6 5-6s5 2 5 6z"
    />
    <path
      v-else-if="name === 'bar'"
      d="M3 2h10L10 9H6z M8 9v4 M5 13h6"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linejoin="round"
    />
    <path
      v-else-if="name === 'market'"
      d="M2 6h12l-1.5 7h-9z M4 6c0-2 1.8-3.5 4-3.5S12 4 12 6"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
    />
    <path
      v-else-if="name === 'fastfood'"
      d="M4 5h8v8H4z M6 5c0-2 4-2 4 0"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
    />
    <path
      v-else-if="name === 'route'"
      d="M3 12 L8 3 L13 12"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linejoin="round"
    />
    <circle
      v-else
      cx="8"
      cy="8"
      r="3"
    />
  </svg>
</template>

<script setup lang="ts">
defineProps<{ name: string }>()
</script>

<style scoped>
.glyph {
  display: block;
  width: 1rem;
  height: 1rem;
  fill: currentColor;
}
</style>
