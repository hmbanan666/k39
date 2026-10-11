<template>
  <a
    v-if="href"
    :href="href"
    class="btn"
    :class="[`btn-${variant}`]"
    v-bind="externalLinkAttrs(href)"
  >
    <slot />
  </a>
  <button
    v-else
    :type="type"
    class="btn"
    :class="[`btn-${variant}`]"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import { externalLinkAttrs } from '~~/shared/links'

withDefaults(defineProps<{
  href?: string
  type?: 'button' | 'submit'
  variant?: 'primary' | 'quiet' | 'sea' | 'amber' | 'line'
  disabled?: boolean
}>(), {
  type: 'button',
  variant: 'primary',
  disabled: false,
})
</script>
