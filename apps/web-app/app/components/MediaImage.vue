<template>
  <figure class="frame">
    <picture>
      <source
        v-if="avif"
        type="image/avif"
        :srcset="avif"
        :sizes="sizes"
      >
      <source
        v-if="webp"
        type="image/webp"
        :srcset="webp"
        :sizes="sizes"
      >
      <img
        :src="media.src"
        :alt="media.alt"
        :width="media.width || 640"
        :height="media.height || 400"
        :loading="priority ? 'eager' : 'lazy'"
        :fetchpriority="priority ? 'high' : undefined"
        :style="imageStyle"
      >
    </picture>
    <figcaption v-if="showCredit && credit">
      <span v-if="media.author">{{ media.author }}</span>
      <a
        v-if="href"
        :href="href"
        rel="noopener"
      >{{ label }}</a>
      <span v-else-if="label">{{ label }}</span>
      <a
        v-if="media.sourceUrl"
        :href="media.sourceUrl"
        rel="noopener"
      >источник</a>
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
import type { PublicMedia } from '~~/shared/media'
import { licenseHref, licenseLabel } from '~~/shared/media'

const props = withDefaults(defineProps<{
  media: PublicMedia
  sizes?: string
  priority?: boolean
  showCredit?: boolean
}>(), {
  sizes: '(min-width: 900px) 640px, 100vw',
  priority: false,
  showCredit: true,
})

const avif = computed(() => srcset('avif'))
const webp = computed(() => srcset('webp'))
const label = computed(() => licenseLabel(props.media.license))
const href = computed(() => licenseHref(props.media.license))
const credit = computed(() => Boolean(props.media.author || label.value || props.media.sourceUrl))
const imageStyle = computed(() => ({
  objectPosition: `${props.media.focalX * 100}% ${props.media.focalY * 100}%`,
  backgroundColor: props.media.dominantColor || 'transparent',
  backgroundImage: props.media.lqip ? `url("${props.media.lqip}")` : undefined,
  backgroundSize: 'cover',
}))

function srcset(format: 'avif' | 'webp') {
  const items = props.media.variants
    .filter((item) => item.format === format && item.file !== 'og.jpg')
    .sort((a, b) => a.width - b.width)
  if (!items.length) {
    return ''
  }
  return items.map((item) => `/media/${props.media.id}/${item.file} ${item.width}w`).join(', ')
}
</script>

<style scoped>
.frame { margin: 0; }
img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 3 / 2;
  object-fit: cover;
  border-radius: 2px;
}
figcaption {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.7rem;
  margin-top: 0.35rem;
  color: var(--muted);
  font-size: 0.78rem;
}
</style>
