<template>
  <div
    ref="frame"
    class="frame"
    :class="variant"
  >
    <div
      v-if="variant === 'page'"
      class="filters"
    >
      <fieldset>
        <legend>Слои</legend>
        <label>
          <input
            v-model="showPlaces"
            type="checkbox"
          >
          Места
        </label>
        <label>
          <input
            v-model="showVenues"
            type="checkbox"
          >
          Заведения
        </label>
        <label>
          <input
            v-model="showRoutes"
            type="checkbox"
          >
          Маршруты
        </label>
      </fieldset>
      <div
        v-if="showVenues && kinds.length"
        class="kinds"
        role="group"
        aria-label="Типы заведений"
      >
        <button
          v-for="kind in kinds"
          :key="kind.kind"
          type="button"
          class="kind"
          :aria-pressed="activeKinds.has(kind.kind)"
          @click="toggleKind(kind.kind)"
        >
          {{ kind.label }}
        </button>
      </div>
    </div>
    <div
      ref="canvas"
      class="canvas"
      role="region"
      :aria-label="label"
    />
    <div
      v-if="!ready"
      class="fallback"
    >
      <slot>
        <p>{{ failed ? 'Карта не загрузилась.' : 'Загрузка карты' }}</p>
      </slot>
    </div>
    <article
      v-if="selected"
      class="card"
      :class="{ 'no-photo': !selected.photo }"
    >
      <img
        v-if="selected.photo"
        class="photo"
        :src="selected.photo.src"
        :alt="selected.photo.alt"
      >
      <div class="card-body">
        <p
          v-if="selected.partner"
          class="partner"
        >
          Партнёр
        </p>
        <h2>{{ selected.title }}</h2>
        <p class="meta">
          {{ selected.typeLabel }}<template v-if="selected.distance">
            · {{ selected.distance }}
          </template>
        </p>
        <p
          v-if="selected.summary"
          class="summary"
        >
          {{ selected.summary }}
        </p>
        <p
          v-if="selected.offer"
          class="offer"
        >
          {{ selected.offer }}
        </p>
        <p class="card-actions">
          <a
            class="more"
            :href="selected.href"
          >Подробнее</a>
          <DirectionsLink
            :latitude="selected.latitude"
            :longitude="selected.longitude"
            :entity="selected.href"
            variant="line"
          />
        </p>
        <button
          type="button"
          class="close"
          @click="selectedId = ''"
        >
          Закрыть
        </button>
      </div>
    </article>
    <button
      v-if="needsUnlock && !selected"
      type="button"
      class="unlock"
      @click="unlock"
    >
      Коснитесь, чтобы двигать карту
    </button>
  </div>
</template>

<script setup lang="ts">
import type { MapPayload, MapPoint } from '~~/shared/embed-map'
import type { DrawPoint, MountedK39Map } from '~/lib/mount-embed-map'

const props = withDefaults(defineProps<{
  variant?: 'embed' | 'page'
  label: string
  latitude?: number | null
  longitude?: number | null
  entity?: string
  routeSlug?: string
}>(), {
  variant: 'embed',
  latitude: null,
  longitude: null,
  entity: '',
  routeSlug: '',
})

const frame = ref<HTMLElement | null>(null)
const canvas = ref<HTMLElement | null>(null)
const ready = ref(false)
const failed = ref(false)
const needsUnlock = ref(false)
const payload = ref<MapPayload | null>(null)
const selectedId = ref('')
const showPlaces = ref(true)
const showVenues = ref(true)
const showRoutes = ref(true)
const activeKinds = ref(new Set<string>())
const kindsReady = ref(false)

let mounted: MountedK39Map | null = null
let observer: IntersectionObserver | undefined
let opened = false

const kinds = computed(() => {
  const labels = new Map<string, string>()
  for (const point of payload.value?.points ?? []) {
    if (point.layer === 'venue' && !labels.has(point.kind)) {
      labels.set(point.kind, point.typeLabel)
    }
  }
  return [...labels.entries()].map(([kind, label]) => ({ kind, label }))
})

const visible = computed(() => {
  const data = payload.value
  if (!data) {
    return [] as DrawPoint[]
  }
  if (props.variant !== 'page') {
    return data.points.map((point) => withFocus(point))
  }
  const routePins: DrawPoint[] = []
  const routeHrefs = new Set<string>()
  if (showRoutes.value) {
    for (const route of data.routes) {
      for (const stop of route.stops) {
        routeHrefs.add(stop.href)
        const place = data.points.find((item) => item.href === stop.href && item.layer === 'place')
        routePins.push(withFocus({
          id: `${route.slug}-${stop.label}-${stop.href}`,
          layer: 'route',
          kind: place?.kind || 'place',
          title: stop.title,
          typeLabel: place?.typeLabel || 'Остановка',
          href: stop.href,
          latitude: stop.latitude,
          longitude: stop.longitude,
          summary: place?.summary || '',
          distanceKm: null,
          distance: '',
          photo: place?.photo ?? null,
          partner: false,
          offer: null,
          label: stop.label,
        }))
      }
    }
  }
  const places = showPlaces.value
    ? data.points.filter((point) => point.layer === 'place' && !(showRoutes.value && routeHrefs.has(point.href)))
    : []
  const venues = showVenues.value
    ? data.points.filter((point) => point.layer === 'venue' && activeKinds.value.has(point.kind))
    : []
  return [...places.map((point) => withFocus(point)), ...venues.map((point) => withFocus(point)), ...routePins]
})

const lines = computed(() => {
  const data = payload.value
  if (!data) {
    return [] as Array<Array<[number, number]>>
  }
  if (props.variant === 'page' && !showRoutes.value) {
    return []
  }
  return data.routes.map((route) => route.stops.map((stop) => [stop.latitude, stop.longitude] as [number, number]))
})

const selected = computed(() => visible.value.find((point) => point.id === selectedId.value) ?? null)

watch(visible, (points) => {
  if (selectedId.value && !points.some((point) => point.id === selectedId.value)) {
    selectedId.value = ''
  }
})

watch([visible, lines], () => {
  if (ready.value) {
    mounted?.setPoints(visible.value, lines.value)
  }
})

function withFocus(point: MapPoint): DrawPoint {
  return { ...point, focus: Boolean(props.entity) && point.href === props.entity }
}

function toggleKind(kind: string) {
  const next = new Set(activeKinds.value)
  if (next.has(kind)) {
    next.delete(kind)
  } else {
    next.add(kind)
  }
  activeKinds.value = next
}

function track(type: 'pin_impression' | 'pin_click', entity: string) {
  if (!entity || typeof window === 'undefined') {
    return
  }
  window.dispatchEvent(new CustomEvent('k39-track', {
    detail: { type, entity, target: entity },
  }))
}

function select(id: string) {
  const point = visible.value.find((item) => item.id === id)
  if (!point) {
    return
  }
  selectedId.value = id
  track('pin_click', point.href)
}

function unlock() {
  mounted?.enableDragging()
  needsUnlock.value = false
}

function requestUrl() {
  const params = new URLSearchParams()
  if (props.variant === 'page') {
    params.set('scope', 'catalog')
    return `/api/public/map?${params}`
  }
  if (props.routeSlug) {
    params.set('scope', 'nearby')
    params.set('route', props.routeSlug)
    return `/api/public/map?${params}`
  }
  if (props.latitude != null && props.longitude != null) {
    params.set('scope', 'nearby')
    params.set('lat', String(props.latitude))
    params.set('lng', String(props.longitude))
    return `/api/public/map?${params}`
  }
  return ''
}

async function openMap() {
  if (opened) {
    return
  }
  const host = canvas.value
  const url = requestUrl()
  if (!host || !url) {
    return
  }
  opened = true
  try {
    payload.value = await $fetch<MapPayload>(url)
    const venueKinds = payload.value.points.filter((point) => point.layer === 'venue').map((point) => point.kind)
    if (!kindsReady.value) {
      activeKinds.value = new Set(venueKinds)
      kindsReady.value = true
    }
  } catch {
    failed.value = true
    return
  }
  const geometry = Boolean(payload.value?.points.length || payload.value?.routes.some((route) => route.stops.length))
  if (props.variant !== 'page' && !geometry) {
    failed.value = true
    return
  }
  try {
    const { mountK39Map } = await import('~/lib/mount-embed-map')
    mounted = await mountK39Map(host, {
      fallbackHeight: props.variant === 'page' ? 420 : 320,
      onSelect: select,
      onImpression: (href) => track('pin_impression', href),
    })
    ready.value = true
    needsUnlock.value = mounted.coarseLock
    mounted.setPoints(visible.value, lines.value)
  } catch {
    ready.value = false
    failed.value = true
  }
}

onMounted(() => {
  const host = frame.value
  if (!host) {
    return
  }
  const arm = () => {
    observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return
      }
      observer?.disconnect()
      void openMap()
    }, { rootMargin: '120px 0px' })
    observer.observe(host)
  }
  const idle = window.requestIdleCallback
  const start = () => {
    if (idle) {
      idle(() => arm(), { timeout: 1500 })
    } else {
      arm()
    }
  }
  if (document.readyState === 'complete') {
    start()
  } else {
    window.addEventListener('load', start, { once: true })
  }
})

onUnmounted(() => {
  observer?.disconnect()
  mounted?.destroy()
  mounted = null
})
</script>

<style scoped>
.frame {
  position: relative;
  height: 320px;
  min-height: 320px;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: 18px;
  background: var(--color-sea-light);
  box-shadow: var(--shadow-card);
}
.frame.page {
  height: calc(100dvh - 4.5rem);
  min-height: 420px;
}
.canvas { position: absolute; inset: 0; z-index: 0; }
.filters {
  position: absolute;
  z-index: 4;
  top: 0.55rem;
  right: 0.55rem;
  left: 0.55rem;
  display: grid;
  gap: 0.35rem;
  max-width: 40rem;
}
.filters fieldset {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  border: 0;
}
.filters legend {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
.filters label,
.kind {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  min-height: 2.2rem;
  padding: 0.25rem 0.7rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: rgb(255 251 243 / 94%);
  color: var(--color-ink);
  font: 700 0.85rem/1.2 var(--font-body);
}
.kind { cursor: pointer; }
.kind[aria-pressed="false"] { opacity: 0.55; }
.kinds { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.fallback {
  position: relative;
  z-index: 1;
  height: 100%;
  margin: 0;
  padding: 1rem 1.15rem;
  overflow: auto;
  background: var(--color-paper);
}
.fallback :deep(ol) { margin: 0; padding: 0; list-style: none; }
.fallback :deep(li) { margin: 0.4rem 0; }
.fallback :deep(a) {
  color: var(--color-sea);
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 700;
  text-decoration: none;
}
.card.no-photo { grid-template-columns: 1fr; }
.card {
  position: absolute;
  z-index: 5;
  right: 0.55rem;
  bottom: 0.55rem;
  left: 0.55rem;
  display: grid;
  grid-template-columns: 4.6rem 1fr;
  gap: 0.7rem;
  max-height: 48%;
  padding: 0.7rem;
  overflow: auto;
  border: 1px solid var(--color-line);
  border-radius: 16px;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.photo {
  width: 4.6rem;
  height: 4.6rem;
  object-fit: cover;
  border-radius: 10px;
  background: var(--color-sand);
}
.card-body { min-width: 0; }
.card h2 {
  margin: 0;
  font-size: 1.15rem;
  line-height: 1.2;
}
.partner {
  display: inline-block;
  margin: 0 0 0.2rem;
  padding: 0.05rem 0.4rem;
  border-radius: 3px;
  background: var(--color-amber-soft);
  color: var(--color-partner);
  font-family: var(--font-stamp);
  font-size: var(--step--1);
}
.meta, .summary, .offer { margin: 0.25rem 0 0; }
.meta { color: var(--color-pine); font-size: 0.88rem; font-weight: 700; }
.summary, .offer { color: var(--muted); font-size: 0.9rem; line-height: 1.35; }
.offer { color: var(--color-ink); }
.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
  margin: 0.55rem 0 0;
}
.more {
  color: var(--color-sea);
  font-weight: 700;
  text-decoration: none;
}
.close {
  margin-top: 0.35rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--muted);
  font: 700 0.82rem/1 var(--font-body);
  cursor: pointer;
}
.unlock {
  position: absolute;
  z-index: 6;
  right: 0.8rem;
  bottom: 0.8rem;
  left: 0.8rem;
  min-height: 2.6rem;
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--color-ink);
  border-radius: 12px;
  background: var(--color-paper);
  color: var(--color-ink);
  font: 700 0.9rem/1.2 var(--font-body);
  cursor: pointer;
}
:deep(.maplibregl-map) {
  width: 100%;
  height: 100%;
  background: var(--color-sea-light);
  font-family: var(--font-body);
}
:deep(.maplibregl-canvas) {
  filter: sepia(0.18) saturate(0.75) hue-rotate(8deg) brightness(1.02);
}
:deep(.k39-pin),
:deep(.k39-cluster) {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 2px solid var(--color-paper);
  border-radius: 50%;
  background: var(--color-sea);
  color: var(--color-paper);
  box-shadow: 0 1px 4px rgb(43 36 32 / 35%);
  cursor: pointer;
}
:deep(.k39-pin svg) { width: 16px; height: 16px; fill: currentColor; }
:deep(.k39-pin-venue) { background: var(--color-pine); }
:deep(.k39-pin-route) {
  background: var(--color-brick);
  font-family: var(--font-display);
  font-weight: 700;
}
:deep(.k39-pin-partner) {
  width: 40px;
  height: 40px;
  background: var(--color-amber);
  color: var(--color-ink);
  box-shadow: 0 0 0 3px var(--color-amber-soft), 0 1px 4px rgb(43 36 32 / 35%);
}
:deep(.k39-pin-focus) { width: 44px; height: 44px; }
:deep(.k39-cluster) {
  width: 42px;
  height: 42px;
  font-family: var(--font-display);
  font-weight: 700;
}
:deep(.maplibregl-ctrl-attrib) {
  background: rgb(245 238 225 / 92%);
  color: var(--color-ink);
  font-size: 11px;
}
:deep(.maplibregl-ctrl-attrib a) { color: var(--color-sea); }
@media (min-width: 900px) {
  .frame:not(.page) { height: 460px; min-height: 460px; }
  .card {
    top: 0.8rem;
    bottom: auto;
    left: auto;
    width: 18.5rem;
    max-height: calc(100% - 1.6rem);
  }
}
</style>
