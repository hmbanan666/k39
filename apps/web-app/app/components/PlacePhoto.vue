<template>
  <div class="shot">
    <MediaImage
      :media="media"
      :priority="priority"
      :sizes="sizes"
      :show-credit="false"
    />
    <button
      class="open"
      type="button"
      :aria-label="`Открыть фото: ${media.alt}`"
      @click="$emit('open')"
    />
    <button
      class="mark"
      type="button"
      aria-label="Автор и лицензия"
      @click="$emit('open')"
    >
      <span aria-hidden="true">ⓘ</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { PublicMedia } from '~~/shared/media'

withDefaults(defineProps<{
  media: PublicMedia
  priority?: boolean
  sizes?: string
}>(), {
  priority: false,
  sizes: '(min-width: 900px) 640px, 100vw',
})

defineEmits<{ open: [] }>()
</script>

<style scoped>
.shot { position: relative; }
.open {
  position: absolute;
  inset: 0;
  z-index: 1;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: zoom-in;
}
.mark {
  position: absolute;
  right: 0.55rem;
  bottom: 0.55rem;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 1.7rem;
  height: 1.7rem;
  border: 1px solid var(--color-ink);
  border-radius: 999px;
  background: var(--color-paper);
  color: var(--color-ink);
  font: 700 0.85rem/1 var(--font-body);
  cursor: pointer;
  box-shadow: var(--shadow-card);
}
</style>
