<template>
  <div
    ref="frame"
    class="frame"
    :style="{ '--map-ui-bottom': controlsBottom }"
  >
    <div
      ref="canvas"
      class="canvas"
      role="region"
      :aria-label="mapLabel"
    />
    <p
      v-if="failed"
      class="fail"
    >
      Карта не загрузилась.
    </p>
    <div class="tools">
      <button
        type="button"
        aria-label="Приблизить"
        @click="zoomIn"
      >
        <Icon
          :name="tablerIcon('zoomIn')"
          size="16"
        />
      </button>
      <button
        type="button"
        aria-label="Отдалить"
        @click="zoomOut"
      >
        <Icon
          :name="tablerIcon('zoomOut')"
          size="16"
        />
      </button>
      <button
        type="button"
        aria-label="Я здесь"
        @click="locate"
      >
        <Icon
          :name="tablerIcon('locate')"
          size="16"
        />
      </button>
      <button
        type="button"
        aria-label="Показать всё"
        @click="fit"
      >
        <Icon
          :name="tablerIcon('fit')"
          size="16"
        />
      </button>
      <button
        v-if="fullscreen"
        type="button"
        :aria-label="expanded ? 'Выйти из полного экрана' : 'На весь экран'"
        @click="toggleFullscreen"
      >
        <Icon
          :name="tablerIcon('fullscreen')"
          size="16"
        />
      </button>
    </div>
    <MapCard
      v-if="cardVisible"
      :point="card"
      :sheet="sheet"
      @close="selectedId = null"
    />
  </div>
</template>

<script setup lang="ts">
import type { MapBounds, MapPoint, RouteOverlay } from '~~/shared/map'
import type { K39MapHandle, MapFramePadding } from '~/lib/mount-k39-map'
import { cardFor } from '@k39/map'
import { tablerIcon } from '~~/shared/icons'
import { visitorLayers } from '~~/shared/map'
import MapCard from '~/components/map/MapCard.vue'
import { fetchBasemapUrl } from '~/lib/basemap-url'

const props = withDefaults(
  defineProps<{
    points: MapPoint[]
    overlay: RouteOverlay | null
    mapLabel: string
    lazy?: boolean
    fullscreen?: boolean
    fitKey?: string
    cardVisible?: boolean
    padding?: MapFramePadding
    controlsBottom?: string
  }>(),
  {
    lazy: true,
    fullscreen: false,
    fitKey: '',
    cardVisible: true,
    padding: undefined,
    controlsBottom: '0.6rem',
  },
)

const emit = defineEmits<{
  ready: []
  error: []
  bounds: [bounds: MapBounds]
  located: [point: { latitude: number; longitude: number }]
}>()
const selectedId = defineModel<string | null>('selected', { default: null })

const frame = ref<HTMLElement | null>(null)
const canvas = ref<HTMLElement | null>(null)
const failed = ref(false)
const expanded = ref(false)
const sheet = ref(false)
const toast = useToast()
const impressed = new Set<string>()

let handle: K39MapHandle | null = null
let observer: IntersectionObserver | undefined
let booted = false

const layers = computed(() => visitorLayers(props.points, props.overlay))
const card = computed(() => cardFor(layers.value, selectedId.value))

function syncSheet() {
  sheet.value = window.matchMedia('(max-width: 720px)').matches
}

async function boot() {
  const el = canvas.value
  if (!el || booted) {
    return
  }
  booted = true
  try {
    const { mountK39Map } = await import('~/lib/mount-k39-map')
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const pmtilesUrl = await fetchBasemapUrl()
    const options = {
      layers: layers.value,
      cooperative: props.lazy || coarse,
      onSelect: (id: string) => {
        selectedId.value = id
      },
      onEmpty: () => {
        selectedId.value = null
      },
      padding: props.padding,
      onBounds: (bounds: MapBounds) => {
        emit('bounds', bounds)
      },
      onLocate: (point: { latitude: number; longitude: number }) => {
        emit('located', point)
      },
    }
    try {
      handle = await mountK39Map(el, { ...options, pmtilesUrl })
    } catch (error) {
      if (!pmtilesUrl) {
        throw error
      }
      handle = await mountK39Map(el, { ...options, pmtilesUrl: '' })
    }
    handle.setSelected(selectedId.value)
    handle.fit()
    emit('ready')
  } catch {
    failed.value = true
    emit('error')
  }
}

function zoomIn() {
  handle?.zoomIn()
}

function zoomOut() {
  handle?.zoomOut()
}

function fit() {
  handle?.fit()
}

async function locate() {
  const result = await handle?.locate()
  if (result === 'denied' || result === 'unavailable') {
    toast.push('Не удалось определить место')
  }
}

function toggleFullscreen() {
  const host = frame.value
  if (!host) {
    return
  }
  if (document.fullscreenElement) {
    void document.exitFullscreen()
  } else {
    void host.requestFullscreen()
  }
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && selectedId.value) {
    selectedId.value = null
  }
}

function onFullscreen() {
  expanded.value = document.fullscreenElement === frame.value
  handle?.resize()
}

watch(layers, (next) => {
  handle?.setLayers(next)
  const id = selectedId.value
  if (id && !cardFor(next, id)) {
    selectedId.value = null
  }
})

watch(
  () => props.fitKey,
  () => {
    handle?.fit()
  },
)

watch(
  () => props.padding,
  (padding) => {
    if (padding) {
      handle?.setPadding(padding)
    }
  },
  { deep: true },
)

watch(selectedId, (id) => {
  handle?.setSelected(id)
  if (id) {
    handle?.reveal(id)
  }
  const point = props.points.find((item) => item.id === id)
  if (!point || point.group !== 'food' || impressed.has(point.id)) {
    return
  }
  impressed.add(point.id)
  window.dispatchEvent(
    new CustomEvent('k39-track', {
      detail: { type: 'impression', target: point.href },
    }),
  )
})

onMounted(() => {
  syncSheet()
  window.addEventListener('resize', syncSheet)
  window.addEventListener('keydown', onKey)
  document.addEventListener('fullscreenchange', onFullscreen)
  const host = frame.value
  if (!host) {
    return
  }
  const start = () => {
    if (!props.lazy) {
      void boot()
      return
    }
    const arm = () => {
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) {
            return
          }
          observer?.disconnect()
          void boot()
        },
        { rootMargin: '120px 0px' },
      )
      observer.observe(host)
    }
    const idle = window.requestIdleCallback
    if (idle) {
      idle(() => arm(), { timeout: 1500 })
    } else {
      arm()
    }
  }
  if (!props.lazy || document.readyState === 'complete') {
    start()
  } else {
    window.addEventListener('load', start, { once: true })
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('resize', syncSheet)
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('fullscreenchange', onFullscreen)
  handle?.destroy()
  handle = null
})
</script>

<style scoped>
.frame {
  position: relative;
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: var(--color-paper-2);
}
.canvas {
  position: absolute;
  inset: 0;
}
.fail {
  position: relative;
  z-index: 1;
  margin: 1rem;
  color: var(--color-ink);
}
.tools {
  position: absolute;
  z-index: 4;
  top: 0.7rem;
  right: 0.7rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: 14px;
  background: var(--color-surface-translucent);
  box-shadow: var(--shadow-card);
}
.tools button {
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  padding: 0;
  border: 0;
  border-bottom: 1px solid var(--color-line);
  background: transparent;
  color: var(--color-ink);
  cursor: pointer;
}
.tools button:last-child {
  border-bottom: 0;
}
.tools button:hover {
  background: var(--color-brick-wash);
  color: var(--color-brick);
}
.tools svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
:deep(.maplibregl-ctrl-attrib) {
  background: transparent;
  font-family: var(--font-body);
  font-size: 11px;
}
:deep(.maplibregl-ctrl-bottom-right),
:deep(.maplibregl-ctrl-bottom-left) {
  bottom: var(--map-ui-bottom, 0.6rem);
}
:deep(.maplibregl-ctrl-attrib.maplibregl-compact) {
  margin: 0 4px 4px 0;
}
:deep(.maplibregl-ctrl-attrib-button) {
  background-color: var(--color-surface-translucent) !important;
  border-radius: 99px;
}
:deep(.maplibregl-ctrl-attrib.maplibregl-compact-show) {
  padding: 2px 6px;
  border-radius: 8px;
  background: var(--color-surface-translucent);
  color: var(--color-ink);
}
:deep(.maplibregl-ctrl-attrib a) {
  color: var(--color-sea);
}
:deep(.maplibregl-ctrl-logo) {
  display: none !important;
}
:deep(.maplibregl-cooperative-gesture-screen) {
  align-items: center;
  justify-content: center;
  background: var(--color-ink-veil);
  color: var(--color-paper);
  font-family: var(--font-body);
}
</style>
