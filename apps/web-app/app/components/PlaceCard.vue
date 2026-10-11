<template>
  <Postcard
    :href="href"
    :src="src"
    :alt="alt"
    caption-tag="h3"
    caption-style="title"
    :caption="title"
    :meta="meta"
    :width="image?.width || media?.width || 640"
    :height="image?.height || media?.height || 400"
  >
    <template
      v-if="media"
      #art
    >
      <MediaImage
        :media="media"
        :show-credit="false"
        sizes="(min-width: 900px) 360px, 80vw"
      />
    </template>
    <p
      v-if="summary"
      class="summary"
    >
      {{ summary }}
    </p>
  </Postcard>
</template>

<script setup lang="ts">
import type { PublicMedia } from '~~/shared/media'
import { illustrationFor } from '~~/shared/illustrations'
import { formatDistance, HUBS } from '~~/shared/links'

const props = withDefaults(defineProps<{
  href: string
  title: string
  hub?: string
  summary?: string
  distanceKm?: number | null
  kind?: string
  image?: { src: string, alt: string, width: number | null, height: number | null } | null
  media?: PublicMedia | null
}>(), {
  hub: '',
  summary: '',
  distanceKm: null,
  kind: '',
  image: null,
  media: null,
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
    bits.push(formatDistance(props.distanceKm))
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
