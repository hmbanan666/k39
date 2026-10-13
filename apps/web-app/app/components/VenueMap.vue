<template>
  <div
    ref="frame"
    class="venue-map"
  />
</template>

<script setup lang="ts">
import type { MountedRouteMap } from '~/lib/mount-route-map'

const props = defineProps<{
  latitude: number
  longitude: number
  title: string
}>()

const frame = ref<HTMLElement | null>(null)
let mounted: MountedRouteMap | null = null

onMounted(async () => {
  const el = frame.value
  if (!el) {
    return
  }
  const { mountRouteMap } = await import('~/lib/mount-route-map')
  mounted = await mountRouteMap(el, [{
    latitude: props.latitude,
    longitude: props.longitude,
    title: props.title,
    label: '1',
  }], useRuntimeConfig().public.yandexMapsApiKey)
})

onBeforeUnmount(() => mounted?.destroy())
</script>

<style scoped>
.venue-map { height: 16rem; border: 1px solid var(--color-line); }
:deep(.leaflet-container) { height: 100%; width: 100%; font-family: var(--font-text); }
:deep(.leaflet-div-icon.route-pin-wrap) { background: transparent; border: none; }
:deep(.leaflet-control-attribution) { font-size: 0.7rem; }
:deep(.leaflet-control-attribution a) { color: var(--color-sea); }
</style>
