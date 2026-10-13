<template>
  <div class="frame">
    <div
      ref="canvas"
      class="canvas"
      role="region"
      aria-label="Карта заведения"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string
  latitude: number
  longitude: number
}>()

const canvas = ref<HTMLElement | null>(null)
const { public: config } = useRuntimeConfig()
let map: { destroy: () => void } | null = null

onBeforeUnmount(() => map?.destroy())

onMounted(async () => {
  const el = canvas.value
  if (!el) {
    return
  }
  const { mountRouteMap } = await import('~/lib/mount-route-map')
  map = await mountRouteMap(el, [{
    latitude: props.latitude,
    longitude: props.longitude,
    label: '•',
    title: props.title,
  }], String(config.yandexMapsApiKey || ''))
})
</script>

<style scoped>
.frame {
  height: 16rem;
  border: 1px solid var(--color-line);
  border-radius: 8px;
  overflow: hidden;
}
.canvas { width: 100%; height: 16rem; }
:deep(.leaflet-container) { width: 100%; height: 16rem; background: var(--color-sea-light); }
:deep(.leaflet-div-icon.route-pin-wrap) { background: transparent; border: none; }
:deep(.route-pin) {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 2px solid var(--color-paper);
  border-radius: 50%;
  background: var(--color-brick);
  color: var(--color-paper);
  font-family: var(--font-display);
}
</style>
