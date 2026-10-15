<template>
  <MetaLink
    :href="href"
    class="ui-link"
  >
    <slot />
  </MetaLink>
</template>

<script setup lang="ts">
defineProps<{ href: string }>()
</script>

<style scoped>
.ui-link { font-weight: 700; }
</style>
