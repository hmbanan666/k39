<template>
  <div
    ref="frame"
    class="frame"
    :class="{ embed: fullscreen }"
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
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
        ><path d="M8 3v10M3 8h10" /></svg>
      </button>
      <button
        type="button"
        aria-label="Отдалить"
        @click="zoomOut"
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
        ><path d="M3 8h10" /></svg>
      </button>
      <button
        type="button"
        aria-label="Я здесь"
        @click="locate"
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
        ><circle
          cx="8"
          cy="8"
          r="2.2"
        /><path d="M8 1.5v2.2M8 12.3v2.2M1.5 8h2.2M12.3 8h2.2" /></svg>
      </button>
      <button
        type="button"
        aria-label="Показать всё"
        @click="fit"
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
        ><path d="M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3" /></svg>
      </button>
      <button
        v-if="fullscreen"
        type="button"
        :aria-label="expanded ? 'Выйти из полного экрана' : 'На весь экран'"
        @click="toggleFullscreen"
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
        ><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" /></svg>
      </button>
    </div>
    <p
      v-if="locateMessage"
      class="locate"
      role="status"
    >
      {{ locateMessage }}
    </p>
    <MapCard
      :point="card"
      :sheet="sheet"
      @close="selectedId = null"
    />
  </div>
</template>

<script setup lang="ts">
import type { MapPoint, RouteOverlay } from '~~/shared/map'
import type { K39MapHandle } from '~/lib/mount-k39-map'
import { cardFor } from '@k39/map'
import { visitorLayers } from '~~/shared/map'
import MapCard from '~/components/map/MapCard.vue'

const props = withDefaults(defineProps<{
  points: MapPoint[]
  overlay: RouteOverlay | null
  mapLabel: string
  lazy?: boolean
  fullscreen?: boolean
  fitKey?: string
}>(), {
  lazy: true,
  fullscreen: false,
  fitKey: '',
})

const emit = defineEmits<{ ready: [], error: [] }>()
const selectedId = defineModel<string | null>('selected', { default: null })

const frame = ref<HTMLElement | null>(null)
const canvas = ref<HTMLElement | null>(null)
const failed = ref(false)
const expanded = ref(false)
const sheet = ref(false)
const locateMessage = ref('')
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
    handle = await mountK39Map(el, {
      layers: layers.value,
      cooperative: props.lazy || coarse,
      pmtilesUrl: String(useRuntimeConfig().public.pmtilesUrl || ''),
      onSelect: (id) => {
        selectedId.value = id
      },
      onEmpty: () => {
        selectedId.value = null
      },
    })
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
  locateMessage.value = ''
  const result = await handle?.locate()
  if (result === 'denied' || result === 'unavailable') {
    locateMessage.value = 'Не удалось определить место'
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

watch(() => props.fitKey, () => {
  handle?.fit()
})

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
  window.dispatchEvent(new CustomEvent('k39-track', {
    detail: { type: 'impression', target: point.href },
  }))
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
      observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return
        }
        observer?.disconnect()
        void boot()
      }, { rootMargin: '120px 0px' })
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
  overflow: hidden;
  background: #efe6d4;
}
.canvas { position: absolute; inset: 0; }
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
  background: rgb(255 251 243 / 94%);
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
.tools button:last-child { border-bottom: 0; }
.tools button:hover { background: rgb(163 64 42 / 8%); color: var(--color-brick); }
.tools svg { width: 1rem; height: 1rem; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.locate {
  position: absolute;
  z-index: 4;
  top: 0.8rem;
  left: 0.8rem;
  margin: 0;
  padding: 0.35rem 0.6rem;
  border-radius: 8px;
  background: rgb(255 251 243 / 94%);
  color: var(--color-ink);
  font-size: 0.82rem;
}
:deep(.maplibregl-ctrl-attrib) {
  background: transparent;
  font-family: var(--font-body);
  font-size: 11px;
}
:deep(.maplibregl-ctrl-bottom-right),
:deep(.maplibregl-ctrl-bottom-left) { bottom: 3.6rem; }
:deep(.maplibregl-ctrl-attrib.maplibregl-compact) { margin: 0 4px 4px 0; }
:deep(.maplibregl-ctrl-attrib-button) {
  background-color: rgb(255 251 243 / 94%) !important;
  border-radius: 99px;
}
:deep(.maplibregl-ctrl-attrib.maplibregl-compact-show) {
  padding: 2px 6px;
  border-radius: 8px;
  background: rgb(255 251 243 / 94%);
  color: var(--color-ink);
}
:deep(.maplibregl-ctrl-attrib a) { color: var(--color-sea); }
:deep(.maplibregl-ctrl-logo) { display: none !important; }
:deep(.maplibregl-cooperative-gesture-screen) {
  align-items: center;
  justify-content: center;
  background: rgb(43 36 32 / 42%);
  color: var(--color-paper);
  font-family: var(--font-body);
}
</style>
