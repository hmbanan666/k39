<template>
  <figure
    v-if="visible"
    class="embed"
    :class="{ fill }"
  >
    <div class="canvas">
      <K39Map
        :points="shown"
        :overlay="overlay"
        :map-label="label"
        :fit-key="fitKey"
        fullscreen
        lazy
        @ready="emit('ready')"
        @error="emit('error')"
      />
    </div>
    <a
      class="open"
      :href="href"
      >Открыть на карте</a
    >
  </figure>
</template>

<script setup lang="ts">
import type { MapPoint, RouteOverlay } from '~~/shared/map'
import { WALKING_RADIUS_KM } from '~~/shared/embed-map'
import { mapFocusHref, pointsNear } from '~~/shared/map'
import K39Map from '~/components/map/K39Map.vue'

const props = withDefaults(
  defineProps<{
    label: string
    /** Place, venue, or route path, such as `/fort-1` or `/marshruty/pyat-fortov`. */
    focusHref: string
    latitude?: number | null
    longitude?: number | null
    /** When set, draw these paths instead of the walking radius. */
    hrefs?: string[]
    overlay?: RouteOverlay | null
    fill?: boolean
  }>(),
  {
    latitude: null,
    longitude: null,
    hrefs: () => [],
    overlay: null,
    fill: false,
  },
)

const emit = defineEmits<{ ready: []; error: [] }>()

const catalog = ref<MapPoint[]>([])
const loaded = ref(false)
const failed = ref(false)

const href = computed(() => mapFocusHref(props.focusHref))
const wanted = computed(() => new Set(props.hrefs))

const shown = computed(() => {
  const points = catalog.value
  if (!points.length) {
    return []
  }
  if (wanted.value.size) {
    return points.filter((point) => wanted.value.has(point.href))
  }
  const stops = props.overlay?.stops ?? []
  const origins = stops.length
    ? stops.map((stop) => ({ latitude: stop.latitude, longitude: stop.longitude }))
    : props.latitude != null && props.longitude != null
      ? [{ latitude: props.latitude, longitude: props.longitude }]
      : []
  const near = pointsNear(points, origins, WALKING_RADIUS_KM)
  const focus = points.filter((point) => point.href === props.focusHref)
  const ids = new Set(near.map((point) => point.id))
  return [...focus.filter((point) => !ids.has(point.id)), ...near]
})

const fitKey = computed(() => shown.value.map((point) => point.id).join('|') + (props.overlay?.stops.length || 0))
const visible = computed(() => !loaded.value || failed.value || shown.value.length > 0)

let catalogPromise: Promise<MapPoint[]> | null = null

function loadCatalog() {
  catalogPromise ??= $fetch<{ points: MapPoint[] }>('/api/public/map').then((body) => body.points)
  return catalogPromise
}

onMounted(() => {
  void loadCatalog()
    .then((points) => {
      catalog.value = points
      loaded.value = true
    })
    .catch(() => {
      failed.value = true
      loaded.value = true
      emit('error')
    })
})
</script>

<style scoped>
figure.embed {
  position: relative;
  height: 320px;
  margin: 1rem 0 1.4rem;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: 16px;
  background: var(--color-paper-2);
}
.canvas {
  height: 100%;
}
.open {
  position: absolute;
  z-index: 4;
  left: 0.65rem;
  bottom: 0.65rem;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-sea);
  font: 700 0.84rem/1 var(--font-body);
  text-decoration: none;
  box-shadow: var(--shadow-card);
}
.open:hover {
  color: var(--color-brick);
}
figure.fill {
  height: 100%;
  margin: 0;
}
@media (min-width: 900px) {
  figure.embed:not(.fill) {
    height: 460px;
  }
}
</style>
