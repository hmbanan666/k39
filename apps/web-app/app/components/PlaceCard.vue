<template>
  <Postcard
    :href="href"
    :src="src"
    :alt="alt"
    caption-tag="h3"
    caption-style="title"
    :caption="title"
    :meta="meta"
    :width="image?.width || 640"
    :height="image?.height || 400"
  >
    <p
      v-if="summary"
      class="summary"
    >
      {{ summary }}
    </p>
  </Postcard>
</template>

<script setup lang="ts">
import { illustrationFor } from '~~/shared/illustrations'
import { HUBS } from '~~/shared/links'

const props = withDefaults(defineProps<{
  href: string
  title: string
  hub?: string
  summary?: string
  distanceKm?: number | null
  kind?: string
  image?: { src: string, alt: string, width: number | null, height: number | null } | null
}>(), {
  hub: '',
  summary: '',
  distanceKm: null,
  kind: '',
  image: null,
})

const slug = computed(() => props.href.split('/').filter(Boolean).pop() || '')
const src = computed(() => props.image?.src || illustrationFor(props.kind, slug.value))
const alt = computed(() => props.image?.alt || props.title)
const meta = computed(() => {
  if (props.distanceKm == null && !props.hub) {
    return ''
  }
  const bits: string[] = []
  const label = props.hub || HUBS.find((item) => item.href === `/${props.kind}`)?.text || ''
  if (props.distanceKm != null && label) {
    bits.push(label)
  } else if (props.hub) {
    bits.push(props.hub)
  }
  if (props.distanceKm != null) {
    bits.push(`${props.distanceKm.toFixed(1)} км`)
  }
  return bits.join(' · ')
})
</script>

<style scoped>
.summary {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.45;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}
</style>
