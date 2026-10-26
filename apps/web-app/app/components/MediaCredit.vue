<template>
  <span
    v-if="media.author || label || media.sourceUrl"
    class="credit"
  >
    <span v-if="media.author">{{ media.author }}</span>
    <MetaLink
      v-if="href"
      :href="href"
    >
      {{ label }}
    </MetaLink>
    <span v-else-if="label">{{ label }}</span>
    <MetaLink
      v-if="media.sourceUrl"
      :href="media.sourceUrl"
    >
      источник
    </MetaLink>
  </span>
</template>

<script setup lang="ts">
import type { PublicMedia } from '~~/shared/media'
import { licenseHref, licenseLabel } from '~~/shared/media'

const props = defineProps<{ media: PublicMedia }>()
const label = computed(() => licenseLabel(props.media.license))
const href = computed(() => licenseHref(props.media.license))
</script>

<style scoped>
.credit {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0 0.4rem;
  font-size: 0.8rem;
}
.credit a {
  color: inherit;
}
</style>
