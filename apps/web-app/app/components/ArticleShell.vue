<template>
  <article class="page">
    <PostcardHero
      v-if="h1"
      :h1="h1"
      :crumbs="crumbs"
      :kicker="kicker"
      :lede="lede"
    />
    <slot />
  </article>
</template>

<script setup lang="ts">
import type { Crumb } from '~~/shared/seo'

withDefaults(defineProps<{
  h1?: string
  crumbs?: Crumb[]
  kicker?: string
  lede?: string
}>(), {
  h1: '',
  crumbs: () => [],
  kicker: '',
  lede: '',
})
</script>
