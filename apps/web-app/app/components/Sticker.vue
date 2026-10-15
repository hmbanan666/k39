<template>
  <picture class="sticker">
    <source
      type="image/avif"
      :srcset="sources.avif"
      :sizes="sizes"
    >
    <source
      type="image/webp"
      :srcset="sources.webp"
      :sizes="sizes"
    >
    <img
      :src="sources.png"
      :alt="decorative ? '' : (alt || sources.alt)"
      :width="width"
      :height="sources.height"
      :loading="priority ? 'eager' : 'lazy'"
      :fetchpriority="priority ? 'high' : undefined"
      decoding="async"
    >
  </picture>
</template>

<script setup lang="ts">
import type { FoodStickerSlug } from '~~/shared/food-stickers'
import type { StickerSlug } from '~~/shared/stickers'
import { computed } from 'vue'
import { FOOD_STICKERS, foodStickerSrc, foodStickerSrcset, isFoodStickerSlug } from '~~/shared/food-stickers'
import { STICKERS, stickerSrc, stickerSrcset } from '~~/shared/stickers'

type StickerBase = {
  /** Rendered width in CSS px. `sizes` matches this. */
  width?: number
  /** Overrides the catalog alt text (Russian). */
  alt?: string
  /** The adjacent text already says what the picture shows. */
  decorative?: boolean
  priority?: boolean
}

type MooseStickerProps = StickerBase & {
  /** Moose mascot. Omit `set` for this. */
  set?: 'moose'
  slug: StickerSlug
}

type FoodStickerProps = StickerBase & {
  /** Price-catalog illustration. See docs/food-stickers.md. */
  set: 'food'
  slug: FoodStickerSlug
}

// One <picture> for both sets: AVIF and WebP at 128/256/512, PNG at 256.
const props = withDefaults(defineProps<MooseStickerProps | FoodStickerProps>(), {
  width: 160,
  alt: undefined,
  decorative: false,
  priority: false,
})

const sources = computed(() => {
  if (props.set === 'food') {
    if (!isFoodStickerSlug(props.slug)) {
      throw new Error(`Unknown food sticker: ${props.slug}`)
    }
    const meta = FOOD_STICKERS[props.slug]
    return {
      avif: foodStickerSrcset(props.slug, 'avif'),
      webp: foodStickerSrcset(props.slug, 'webp'),
      png: foodStickerSrc(props.slug, 256, 'png'),
      alt: meta.alt,
      height: Math.round(props.width * meta.height / meta.width),
    }
  }
  if (!(props.slug in STICKERS)) {
    throw new Error(`Unknown sticker: ${props.slug}`)
  }
  const slug = props.slug as StickerSlug
  const meta = STICKERS[slug]
  return {
    avif: stickerSrcset(slug, 'avif'),
    webp: stickerSrcset(slug, 'webp'),
    png: stickerSrc(slug, 256, 'png'),
    alt: meta.alt,
    height: Math.round(props.width * meta.height / meta.width),
  }
})

const sizes = computed(() => `${props.width}px`)
</script>

<style scoped>
.sticker {
  display: inline-block;
  line-height: 0;
}
img {
  display: block;
  max-width: 100%;
  height: auto;
}
</style>
