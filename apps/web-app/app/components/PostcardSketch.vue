<template>
  <svg
    class="sketch"
    viewBox="0 0 320 200"
    :width="width"
    :height="height"
    role="img"
    :aria-label="label"
  >
    <rect
      width="320"
      height="200"
      fill="#dce5e8"
    />
    <rect
      y="120"
      width="320"
      height="80"
      fill="#355468"
    />
    <circle
      cx="250"
      cy="48"
      r="22"
      fill="#f6e2be"
    />
    <rect
      x="36"
      y="78"
      width="150"
      height="78"
      rx="4"
      fill="#a3402a"
    />
    <rect
      x="92"
      y="108"
      width="36"
      height="48"
      fill="#7a2e1f"
    />
    <rect
      x="48"
      y="96"
      width="22"
      height="18"
      fill="#f5eee1"
    />
    <rect
      x="150"
      y="96"
      width="22"
      height="18"
      fill="#f5eee1"
    />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ label?: string, width?: number, height?: number }>(), {
  label: 'Рисунок места',
  width: 640,
  height: 400,
})
</script>

<style scoped>
.sketch { display: block; width: 100%; height: auto; }
</style>
