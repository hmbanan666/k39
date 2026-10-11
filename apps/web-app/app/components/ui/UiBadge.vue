<template>
  <a
    v-if="href"
    :href="href"
    class="badge"
    :class="[tone ? `badge-${tone}` : '']"
  >
    <slot />
  </a>
  <span
    v-else
    class="badge"
    :class="[tone ? `badge-${tone}` : '']"
  >
    <slot />
  </span>
</template>

<script setup lang="ts">
defineProps<{
  href?: string
  tone?: 'brick' | 'amber' | 'pine'
}>()
</script>
