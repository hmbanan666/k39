<template>
  <MetaLink
    v-if="href"
    :href="href"
    class="btn"
    :class="[`btn-${variant}`]"
  >
    <slot />
  </MetaLink>
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
withDefaults(
  defineProps<{
    href?: string
    type?: 'button' | 'submit'
    variant?: 'primary' | 'quiet' | 'sea' | 'amber' | 'line'
    disabled?: boolean
  }>(),
  {
    type: 'button',
    variant: 'primary',
    disabled: false,
  },
)
</script>
