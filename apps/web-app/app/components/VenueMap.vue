<template>
  <div class="venue-map">
    <K39Map
      :points="points"
      :overlay="null"
      fullscreen
      map-label="Карта заведения"
      fit-key="venue"
    />
  </div>
</template>

<script setup lang="ts">
import type { MapPoint } from '~~/shared/map'
import K39Map from '~/components/map/K39Map.vue'

const props = defineProps<{
  title: string
  latitude: number
  longitude: number
  href: string
  kind?: string
  kindLabel?: string
  summary?: string
  photo?: string | null
  partner?: boolean
  stale?: boolean
}>()

const points = computed<MapPoint[]>(() => [{
  id: 'venue',
  group: 'food',
  slug: props.href,
  title: props.title,
  href: props.href,
  latitude: props.latitude,
  longitude: props.longitude,
  category: props.kind || 'cafe',
  marker: props.kind || 'cafe',
  church: false,
  kindLabel: props.kindLabel || 'Заведение',
  summary: props.summary || '',
  photo: props.photo || null,
  partner: props.partner === true,
  stale: props.stale === true,
}])
</script>

<style scoped>
.venue-map {
  height: 18rem;
  margin: 1rem 0 1.4rem;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: 16px;
}
</style>
