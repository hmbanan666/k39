<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="photo-viewer-overlay" />
      <DialogContent
        class="photo-viewer"
        @keydown.left.prevent="step(-1)"
        @keydown.right.prevent="step(1)"
      >
        <DialogTitle class="sr">
          Фотографии
        </DialogTitle>
        <DialogDescription class="sr">
          {{ photo ? alt : 'Просмотр фотографий места' }}
        </DialogDescription>
        <DialogClose
          class="close"
          type="button"
          aria-label="Закрыть"
        >
          ×
        </DialogClose>
        <div
          v-if="photo"
          class="stage"
          @touchstart.passive="touchStart"
          @touchend.passive="touchEnd"
        >
          <button
            class="nav prev"
            type="button"
            aria-label="Предыдущее фото"
            :disabled="index <= 0"
            @click="step(-1)"
          >
            ‹
          </button>
          <picture>
            <source
              v-if="avif"
              type="image/avif"
              :srcset="avif"
            >
            <img
              :src="webp || photo.src"
              :alt="alt"
              :width="photo.width || 1600"
              :height="photo.height || 1000"
            >
          </picture>
          <button
            class="nav next"
            type="button"
            aria-label="Следующее фото"
            :disabled="index >= photos.length - 1"
            @click="step(1)"
          >
            ›
          </button>
          <div class="foot">
            <AuthorBadge
              v-if="author"
              :author="author"
            />
            <p class="count">
              {{ index + 1 }} / {{ photos.length }}
            </p>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import type { PublicMedia } from '~~/shared/media'
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { authorFromMedia, describedAlt, largestVariantUrl } from '~~/shared/media'

const props = defineProps<{ photos: PublicMedia[] }>()
const open = defineModel<boolean>('open', { default: false })
const index = defineModel<number>('index', { default: 0 })

const photo = computed(() => props.photos[index.value] ?? null)
const author = computed(() => photo.value ? authorFromMedia(photo.value) : null)
const alt = computed(() => photo.value ? describedAlt(photo.value.alt, photo.value.author, photo.value.license) : '')
const avif = computed(() => photo.value ? largestVariantUrl(photo.value, 'avif') : '')
const webp = computed(() => photo.value ? largestVariantUrl(photo.value, 'webp') : '')

function step(delta: number) {
  const next = index.value + delta
  if (next < 0 || next >= props.photos.length) {
    return
  }
  index.value = next
}

function hashFor(id: string | null) {
  const url = new URL(window.location.href)
  const next = id ? `#photo-${id}` : ''
  if (url.hash === next) {
    return
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}${next}`)
}

watch([open, index], () => {
  if (!import.meta.client) {
    return
  }
  hashFor(open.value && photo.value ? photo.value.id : null)
})

onMounted(() => {
  const id = window.location.hash.replace(/^#photo-/, '')
  const found = props.photos.findIndex((item) => item.id === id)
  if (found >= 0) {
    index.value = found
    open.value = true
  }
})

let startX = 0
function touchStart(event: TouchEvent) {
  startX = event.changedTouches[0]?.clientX ?? 0
}
function touchEnd(event: TouchEvent) {
  const dx = (event.changedTouches[0]?.clientX ?? 0) - startX
  if (dx > 48) {
    step(-1)
  }
  if (dx < -48) {
    step(1)
  }
}
</script>

<style>
.photo-viewer-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgb(28 24 22 / 92%);
}
.photo-viewer {
  position: fixed;
  inset: 0;
  z-index: 81;
  display: grid;
  place-items: center;
  padding: 3.4rem 1rem 1rem;
  border: 0;
  background: transparent;
  outline: none;
}
.photo-viewer .sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
.photo-viewer .close {
  position: absolute;
  top: 0.8rem;
  right: 0.8rem;
  width: 2.4rem;
  height: 2.4rem;
  border: 1px solid var(--color-paper);
  border-radius: 999px;
  background: transparent;
  color: var(--color-paper);
  font: 500 1.6rem/1 var(--font-body);
  cursor: pointer;
}
.photo-viewer .stage {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85rem;
  width: min(68rem, calc(100% - 5.5rem));
}
.photo-viewer img {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 9.5rem);
  object-fit: contain;
  background: #1c1816;
}
.photo-viewer .foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  width: min(100%, 52rem);
}
.photo-viewer .count {
  margin: 0;
  color: var(--color-paper);
  font: 600 0.82rem/1 var(--font-body);
}
.photo-viewer .nav {
  position: absolute;
  top: 42%;
  z-index: 2;
  width: 2.6rem;
  height: 2.6rem;
  border: 1px solid var(--color-ink);
  border-radius: 999px;
  background: var(--color-paper);
  color: var(--color-ink);
  font: 600 1.7rem/1 var(--font-body);
  cursor: pointer;
}
.photo-viewer .nav:disabled { opacity: 0.35; cursor: default; }
.photo-viewer .prev { left: -3rem; }
.photo-viewer .next { right: -3rem; }
@media (max-width: 719px) {
  .photo-viewer .nav { display: none; }
  .photo-viewer img { max-height: calc(100vh - 11rem); }
}
</style>
