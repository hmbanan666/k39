<template>
  <label class="field">
    <span class="field-label">{{ label }}</span>
    <slot />
    <span
      v-if="count != null"
      class="field-count"
      >{{ count }}<template v-if="max"> / {{ max }}</template></span
    >
    <p
      v-if="hint"
      class="field-hint"
    >
      {{ hint }}
    </p>
  </label>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  hint?: string | null
  count?: number | null
  max?: number | null
}>()
</script>
