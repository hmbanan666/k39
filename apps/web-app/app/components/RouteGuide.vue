<template>
  <section
    v-if="stops.length"
    class="guide"
  >
    <div
      v-if="links"
      class="actions"
    >
      <UiButton
        class="go"
        :href="links.yandex"
      >
        Построить маршрут в Яндекс Картах
      </UiButton>
      <RadioGroupRoot
        v-model="mode"
        class="modes"
        orientation="horizontal"
        aria-label="Как добираться"
      >
        <RadioGroupItem
          v-for="option in ROUTE_TRAVEL_MODES"
          :key="option.value"
          class="mode"
          :value="option.value"
        >
          {{ option.label }}
        </RadioGroupItem>
      </RadioGroupRoot>
      <UiButton
        variant="line"
        :href="links.google"
      >
        В Google Maps
      </UiButton>
    </div>
    <div class="split">
      <div
        ref="frame"
        class="frame"
        :class="{ locked: needsUnlock }"
      >
        <div
          ref="canvas"
          class="canvas"
          role="region"
          aria-label="Карта маршрута"
        />
        <ol
          class="fallback"
          :hidden="ready"
        >
          <li
            v-for="(stop, index) in stops"
            :key="`${stop.href}-fallback-${index}`"
          >
            <a :href="stop.href">{{ index + 1 }}. {{ stop.text }}</a>
          </li>
        </ol>
        <button
          v-if="needsUnlock"
          type="button"
          class="unlock"
          @click="unlock"
        >
          Коснитесь, чтобы двигать карту
        </button>
      </div>
      <div class="stop-col">
        <h2 class="stops-title">
          Остановки
        </h2>
        <ol class="cards">
          <li
            v-for="(stop, index) in stops"
            :key="`${stop.href}-card-${index}`"
          >
            <span class="n">{{ index + 1 }}</span>
            <div class="body">
              <a
                class="name"
                :href="stop.href"
              >{{ stop.text }}</a>
              <p
                v-if="stop.note"
                class="note"
              >
                {{ stop.note }}
              </p>
              <p
                v-if="stop.distanceLabel"
                class="leg"
              >
                {{ stop.distanceLabel }}
              </p>
            </div>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { RouteStopView, RouteTravelMode } from '~~/shared/route-nav'
import type { MountedRouteMap } from '~/lib/mount-route-map'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { locatedStops, ROUTE_TRAVEL_MODES, routeLinks } from '~~/shared/route-nav'

const props = defineProps<{ stops: RouteStopView[] }>()
const mode = ref<RouteTravelMode>('auto')
const ready = ref(false)
const needsUnlock = ref(false)
const frame = ref<HTMLElement | null>(null)
const canvas = ref<HTMLElement | null>(null)
const apiKey = useRuntimeConfig().public.yandexMapsApiKey
const points = computed(() => locatedStops(props.stops))
const links = computed(() => routeLinks(points.value, mode.value))

let mounted: MountedRouteMap | null = null
let observer: IntersectionObserver | undefined
let opened = false

function unlock() {
  mounted?.enableDragging()
  needsUnlock.value = false
}

async function openMap() {
  if (opened) {
    return
  }
  const el = canvas.value
  if (!el || !points.value.length) {
    return
  }
  opened = true
  try {
    const { mountRouteMap } = await import('~/lib/mount-route-map')
    mounted = await mountRouteMap(el, points.value, apiKey)
    ready.value = true
    needsUnlock.value = mounted.coarseLock
  } catch {
    ready.value = false
  }
}

onMounted(() => {
  const host = frame.value
  if (!host || !points.value.length) {
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
.guide { margin: 0 0 var(--space-6); }
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem 0.75rem;
  align-items: center;
  margin-bottom: 0.9rem;
}
.modes { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.mode {
  min-height: 2.4rem;
  padding: 0.35rem 0.8rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--color-ink);
  font: 700 0.88rem/1 var(--font-body);
  cursor: pointer;
}
.mode[data-state="checked"] {
  border-color: var(--color-sea);
  background: var(--color-sea);
  color: var(--color-paper);
}
.split { display: grid; gap: 1rem; align-items: start; }
.frame {
  position: relative;
  z-index: 0;
  height: 300px;
  overflow: hidden;
  isolation: isolate;
  border: 1px solid var(--color-line);
  border-radius: 18px;
  background: var(--color-sea-light);
  box-shadow: var(--shadow-card);
}
.canvas { position: absolute; inset: 0; z-index: 0; }
.fallback {
  position: relative;
  z-index: 1;
  height: 100%;
  margin: 0;
  padding: 1rem 1.15rem;
  overflow: auto;
  list-style: none;
  background: var(--color-paper);
}
.fallback li { margin: 0.4rem 0; }
.fallback a {
  color: var(--color-sea);
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 700;
  text-decoration: none;
}
.unlock {
  position: absolute;
  z-index: 2;
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
.stops-title { margin: 0 0 var(--space-3); font-size: var(--step-1); }
.cards { display: grid; gap: 0.7rem; margin: 0; padding: 0; list-style: none; }
.cards li {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem;
  align-items: start;
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--color-line);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
.n {
  display: grid;
  place-items: center;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 50%;
  background: var(--color-brick);
  color: var(--color-paper);
  font-family: var(--font-display);
  font-weight: 700;
}
.name {
  color: var(--color-sea);
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.2;
  text-decoration: none;
}
.note { margin: 0.25rem 0 0; color: var(--muted); font-size: 0.92rem; line-height: 1.4; }
.leg { margin: 0.35rem 0 0; color: var(--color-pine); font-size: 0.92rem; font-weight: 700; }
:deep(.leaflet-container) {
  width: 100%;
  height: 100%;
  background: var(--color-sea-light);
  font-family: var(--font-body);
}
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
  box-shadow: 0 1px 4px rgb(43 36 32 / 35%);
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 700;
}
:deep(.yandex-pin) { transform: translate(-50%, -50%); }
:deep(.leaflet-control-attribution) {
  background: rgb(245 238 225 / 92%);
  color: var(--color-ink);
  font-size: 11px;
}
:deep(.leaflet-control-attribution a) { color: var(--color-sea); }
@media (max-width: 720px) {
  .go { flex: 1 1 100%; }
  .modes { flex: 1 1 100%; }
}
@media (min-width: 900px) {
  .split { grid-template-columns: minmax(0, 1.4fr) minmax(16rem, 0.75fr); }
  .frame { height: 460px; }
}
</style>
