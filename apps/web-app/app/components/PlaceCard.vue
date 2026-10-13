<template>
  <Postcard
    class="place-card"
    :class="{ stack: metaPlace === 'stack' }"
    :href="href"
    :src="src"
    :alt="alt"
    caption-tag="h3"
    caption-style="title"
    :caption="title"
    :meta="metaPlace === 'stack' ? '' : meta"
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
      v-if="meta && metaPlace === 'stack'"
      class="meta"
    >
      {{ meta }}
    </p>
    <p
      v-if="summary"
      class="summary"
      :style="{ '--lines': String(summaryLines) }"
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
  town?: string
  summary?: string
  summaryLines?: number
  metaPlace?: 'aside' | 'stack'
  distanceKm?: number | null
  kind?: string
  image?: { src: string, alt: string, width: number | null, height: number | null } | null
  media?: PublicMedia | null
}>(), {
  hub: '',
  town: '',
  summary: '',
  summaryLines: 3,
  metaPlace: 'aside',
  distanceKm: null,
  kind: '',
  image: null,
  media: null,
})

const slug = computed(() => props.href.split('/').filter(Boolean).pop() || '')
const src = computed(() => props.image?.src || illustrationFor(props.kind, slug.value))
const alt = computed(() => props.image?.alt || props.title)
const meta = computed(() => {
  const bits: string[] = []
  const fromKind = props.distanceKm != null
    ? (HUBS.find((item) => item.href === `/${props.kind}`)?.text || '')
    : ''
  const label = props.hub || fromKind
  if (label) {
    bits.push(label)
  }
  if (props.town) {
    bits.push(props.town)
  }
  if (props.distanceKm != null) {
    bits.push(formatDistance(props.distanceKm))
  }
  return bits.join(' · ')
})
</script>

<style scoped>
.stack :deep(.cap) { display: block; }
.stack :deep(.caption) {
  min-width: 0;
  overflow-wrap: break-word;
}
.meta {
  margin: 0.45rem 0 0;
  color: var(--color-pine);
  font: 600 0.82rem/1.3 var(--font-body);
}
.summary {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.45;
  -webkit-line-clamp: var(--lines, 3);
  line-clamp: var(--lines, 3);
  -webkit-box-orient: vertical;
}
.stack .summary { margin-top: 0.35rem; }
</style>
