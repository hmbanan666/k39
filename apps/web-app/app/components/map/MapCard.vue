<template>
  <article
    v-if="point"
    class="card"
    :class="{ sheet }"
    @touchstart.passive="onStart"
    @touchend.passive="onEnd"
  >
    <button
      class="x"
      type="button"
      aria-label="Закрыть"
      @click="emit('close')"
    >
      <Icon :name="tablerIcon('dismiss')" size="16" />
    </button>
    <img
      class="photo"
      :class="{ art: !point.photo }"
      :src="point.photo || markerArt(point.marker)"
      alt=""
    >
    <div class="copy">
      <p
        v-if="point.partner"
        class="partner"
      >
        Партнёр
      </p>
      <p class="title">
        {{ point.title }}
      </p>
      <p class="meta">
        {{ point.kindLabel }}
        <span v-if="point.stale"> · Давно не проверяли</span>
      </p>
      <p
        v-if="point.summary"
        class="sum"
      >
        {{ point.summary }}
      </p>
      <UiButton
        class="open"
        :href="point.href"
      >
        Открыть
      </UiButton>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { MapCard } from '@k39/map'
import { tablerIcon } from '~~/shared/icons'
import { markerArt } from '~~/shared/map'

defineProps<{
  point: MapCard | null
  sheet: boolean
}>()

const emit = defineEmits<{ close: [] }>()

let startY = 0

function onStart(event: TouchEvent) {
  startY = event.changedTouches[0]?.clientY ?? 0
}

function onEnd(event: TouchEvent) {
  const y = event.changedTouches[0]?.clientY ?? startY
  if (y - startY > 56) {
    emit('close')
  }
}
</script>

<style scoped>
.card {
  position: absolute;
  z-index: 5;
  right: 0.8rem;
  bottom: 4.4rem;
  left: 0.8rem;
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr);
  gap: 0.75rem;
  max-width: 24rem;
  padding: 0.7rem;
  border: 1px solid var(--color-line);
  border-radius: 16px;
  background: var(--color-surface);
  box-shadow: var(--shadow-pop);
}
.sheet {
  right: 0;
  bottom: 3.6rem;
  left: 0;
  max-width: none;
  grid-template-columns: 4.5rem minmax(0, 1fr);
  gap: 0.55rem;
  padding: 0.85rem 0.9rem 1rem;
  border-right: 0;
  border-bottom: 0;
  border-left: 0;
  border-radius: 18px 18px 0 0;
}
.sheet::before {
  content: "";
  display: block;
  width: 2.4rem;
  height: 0.28rem;
  margin: 0 auto 0.15rem;
  border-radius: 99px;
  background: var(--color-line);
  grid-column: 1 / -1;
}
.photo {
  width: 4.5rem;
  height: 4.5rem;
  object-fit: cover;
  border-radius: 10px;
  background: var(--color-sand);
}
.sheet .photo {
  width: 100%;
  height: 4.6rem;
  border-radius: 12px;
}
.sheet .photo.art {
  width: 4.5rem;
  height: 4.5rem;
  object-fit: contain;
  background: var(--color-sand);
}
.copy { min-width: 0; padding-right: 1.4rem; }
.title {
  margin: 0;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.15;
}
.meta, .sum {
  margin: 0.2rem 0 0;
  color: var(--muted);
  font-size: 0.86rem;
  line-height: 1.35;
}
.sum {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.open { margin-top: 0.55rem; }
.partner {
  display: inline-block;
  margin: 0 0 0.2rem;
  padding: 0.05rem 0.4rem;
  border-radius: 3px;
  background: var(--color-amber-soft);
  color: var(--color-partner);
  font-family: "Alegreya SC", serif;
  font-size: 0.78rem;
}
.x {
  position: absolute;
  top: 0.45rem;
  right: 0.45rem;
  display: grid;
  place-items: center;
  width: 1.8rem;
  height: 1.8rem;
  padding: 0;
  border: 0;
  border-radius: 99px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}
.x svg { width: 0.9rem; height: 0.9rem; }
.x:hover { color: var(--color-ink); background: rgb(43 36 32 / 6%); }
@media (min-width: 721px) {
  .card { left: 0.8rem; right: auto; width: min(24rem, calc(100% - 1.6rem)); }
}
</style>
