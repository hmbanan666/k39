<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger
      class="btn btn-line map-open-trigger"
      type="button"
    >
      Открыть на карте
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay class="map-open-overlay" />
      <DialogContent class="map-open-sheet">
        <DialogTitle class="map-open-title">
          Открыть на карте
        </DialogTitle>
        <DialogDescription class="map-open-desc">
          {{ name }}
        </DialogDescription>
        <ul class="map-open-list">
          <li
            v-for="link in links"
            :key="link.id"
          >
            <a
              :href="link.href"
              target="_blank"
              rel="noopener nofollow"
              data-track="outbound"
              :data-track-name="`map-${link.id}`"
              :data-track-entity="entity"
            >{{ link.label }}</a>
          </li>
          <li v-if="address">
            <button
              type="button"
              @click="copyAddress"
            >
              {{ copied ? 'Адрес скопирован' : 'Скопировать адрес' }}
            </button>
          </li>
        </ul>
        <DialogClose
          class="btn btn-quiet map-open-close"
          type="button"
        >
          Закрыть
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, DialogTrigger } from 'reka-ui'
import { mapPinLinks } from '~~/shared/embed-map'

// Reka Dialog gives focus trap, Esc and focus return. Phones get a bottom sheet.
const props = defineProps<{
  latitude: number
  longitude: number
  name: string
  address?: string
  entity: string
}>()
const open = ref(false)
const copied = ref(false)
const links = computed(() => mapPinLinks(props.latitude, props.longitude))

async function copyAddress() {
  if (!props.address) {
    return
  }
  try {
    await navigator.clipboard.writeText(props.address)
    copied.value = true
  } catch {
    copied.value = false
  }
}

watch(open, (value) => {
  if (!value) {
    copied.value = false
  }
})
</script>

<style>
.map-open-trigger { margin: 0.2rem 0 0.6rem; }
.map-open-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-dialog);
  background: var(--color-overlay);
}
.map-open-sheet {
  position: fixed;
  z-index: var(--z-dialog);
  top: 50%;
  left: 50%;
  width: min(22rem, calc(100vw - 2rem));
  padding: var(--space-5);
  transform: translate(-50%, -50%);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-pop);
}
.map-open-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--step-1);
}
.map-open-desc {
  margin: 0.3rem 0 1rem;
  color: var(--color-muted);
  font-size: var(--step--1);
}
.map-open-list { margin: 0 0 1rem; padding: 0; list-style: none; }
.map-open-list li { border-top: 1px solid var(--color-line); }
.map-open-list a,
.map-open-list button {
  display: block;
  width: 100%;
  padding: 0.8rem 0;
  border: 0;
  background: none;
  color: var(--color-sea);
  font: 700 1rem/1.3 var(--font-body);
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}
.map-open-list a:hover,
.map-open-list button:hover { text-decoration: underline; }
.map-open-close { width: 100%; }
@media (max-width: 720px) {
  .map-open-sheet {
    top: auto;
    bottom: 0;
    left: 0;
    width: 100%;
    padding-bottom: max(var(--space-5), env(safe-area-inset-bottom));
    transform: none;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
  }
}
</style>
