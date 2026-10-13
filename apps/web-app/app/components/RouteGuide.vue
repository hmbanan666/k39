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
      <div class="frame">
        <MapEmbed
          fill
          label="Карта маршрута"
          :focus-href="focusHref"
          :overlay="overlay"
          @ready="ready = true"
          @error="ready = true"
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
              <DirectionsLink
                v-if="stop.latitude != null && stop.longitude != null"
                class="stop-go"
                variant="line"
                :latitude="stop.latitude"
                :longitude="stop.longitude"
                :entity="stop.href"
              />
            </div>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { MapRoute } from '~~/shared/map'
import type { RouteStopView, RouteTravelMode } from '~~/shared/route-nav'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { routeOverlay } from '~~/shared/map'
import { locatedStops, ROUTE_TRAVEL_MODES, routeLinks } from '~~/shared/route-nav'

const props = defineProps<{
  stops: RouteStopView[]
  path?: [number, number][] | null
  focusHref: string
}>()
const mode = ref<RouteTravelMode>('auto')
const ready = ref(false)
const points = computed(() => locatedStops(props.stops))
const links = computed(() => routeLinks(points.value, mode.value))
const overlay = computed(() => routeOverlay({
  slug: 'page',
  title: '',
  href: '',
  path: props.path || null,
  stops: props.stops.flatMap((stop, index) => {
    if (stop.latitude == null || stop.longitude == null) {
      return []
    }
    return [{
      position: index + 1,
      title: stop.text,
      href: stop.href,
      latitude: stop.latitude,
      longitude: stop.longitude,
      summary: stop.note || '',
      photo: null,
    }]
  }),
} satisfies MapRoute))
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
  background: #efe6d4;
  box-shadow: var(--shadow-card);
}
.fallback {
  position: absolute;
  z-index: 1;
  inset: 0;
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
  overflow-wrap: break-word;
}
.stops-title { margin: 0 0 var(--space-3); font-size: var(--step-1); }
.cards { display: grid; gap: 0.7rem; margin: 0; padding: 0; list-style: none; }
.cards li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
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
.body { min-width: 0; }
.name {
  display: block;
  color: var(--color-sea);
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.2;
  text-decoration: none;
  overflow-wrap: break-word;
}
.note {
  margin: 0.25rem 0 0;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.4;
  overflow-wrap: break-word;
}
.leg { margin: 0.35rem 0 0; color: var(--color-pine); font-size: 0.92rem; font-weight: 700; }
.stop-go { margin-top: 0.45rem; }
@media (max-width: 720px) {
  .go { flex: 1 1 100%; }
  .modes { flex: 1 1 100%; }
}
@media (min-width: 900px) {
  .split { grid-template-columns: minmax(0, 1.4fr) minmax(16rem, 0.75fr); }
  .frame { height: 460px; }
}
</style>
