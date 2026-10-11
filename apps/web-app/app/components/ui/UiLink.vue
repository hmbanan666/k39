<template>
  <a
    :href="href"
    class="ui-link"
    v-bind="externalLinkAttrs(href)"
  >
    <slot />
  </a>
</template>

<script setup lang="ts">
import { externalLinkAttrs } from '~~/shared/links'

defineProps<{ href: string }>()
</script>

<style scoped>
.ui-link { font-weight: 700; }
</style>
