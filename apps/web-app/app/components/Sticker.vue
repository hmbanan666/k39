<template>
  <picture class="sticker">
    <source
      type="image/avif"
      :srcset="stickerSrcset(slug, 'avif')"
      :sizes="sizes"
    >
    <source
      type="image/webp"
      :srcset="stickerSrcset(slug, 'webp')"
      :sizes="sizes"
    >
    <img
      :src="stickerSrc(slug, 256, 'png')"
      :alt="decorative ? '' : (alt || meta.alt)"
      :width="width"
      :height="height"
      :loading="priority ? 'eager' : 'lazy'"
      :fetchpriority="priority ? 'high' : undefined"
      decoding="async"
    >
  </picture>
</template>

<script setup lang="ts">
import type { StickerSlug } from '~~/shared/stickers'
import { STICKERS, stickerSrc, stickerSrcset } from '~~/shared/stickers'

// Mascot sticker. Rules and catalog: docs/stickers.md. At most two per page.
const props = withDefaults(defineProps<{
  slug: StickerSlug
  /** Rendered width in CSS px. */
  width?: number
  /** Overrides the catalog alt text (Russian). */
  alt?: string
  /** The adjacent text already says what the picture shows. */
  decorative?: boolean
  priority?: boolean
}>(), {
  width: 160,
  alt: undefined,
  decorative: false,
  priority: false,
})

const meta = computed(() => STICKERS[props.slug])
const height = computed(() => Math.round(props.width * meta.value.height / meta.value.width))
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
