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
        :alt="alt"
        :width="media.width || 640"
        :height="media.height || 400"
        :loading="priority ? 'eager' : 'lazy'"
        :fetchpriority="priority ? 'high' : undefined"
        :style="imageStyle"
      >
    </picture>
    <figcaption v-if="showCredit && credit">
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
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
import type { PublicMedia } from '~~/shared/media'
import { describedAlt, licenseHref, licenseLabel, variantSrcset } from '~~/shared/media'

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

const alt = computed(() => describedAlt(props.media.alt, props.media.author, props.media.license))
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
  return variantSrcset(props.media, format)
}
</script>

<style scoped>
.frame {
  width: 100%;
  min-width: 0;
  margin: 0;
}
/* <picture> is inline by default and shrinks to the image's intrinsic size,
   which left an empty strip inside wider frames. */
picture {
  display: block;
  width: 100%;
}
img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: var(--ratio, 3 / 2);
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
