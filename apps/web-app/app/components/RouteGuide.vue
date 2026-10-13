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
      <K39Map
        class="route-map"
        label="Карта маршрута"
        :route-slug="routeSlug"
      >
        <ol>
          <li
            v-for="(stop, index) in stops"
            :key="`${stop.href}-fallback-${index}`"
          >
            <a :href="stop.href">{{ index + 1 }}. {{ stop.text }}</a>
          </li>
        </ol>
      </K39Map>
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
import type { RouteStopView, RouteTravelMode } from '~~/shared/route-nav'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { locatedStops, ROUTE_TRAVEL_MODES, routeLinks } from '~~/shared/route-nav'

const props = defineProps<{ stops: RouteStopView[], routeSlug: string }>()
const mode = ref<RouteTravelMode>('auto')
const points = computed(() => locatedStops(props.stops))
const links = computed(() => routeLinks(points.value, mode.value))
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
.route-map { margin: 0; }
.stop-go { margin-top: 0.45rem; }
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
@media (max-width: 720px) {
  .go { flex: 1 1 100%; }
  .modes { flex: 1 1 100%; }
}
@media (min-width: 900px) {
  .split { grid-template-columns: minmax(0, 1.4fr) minmax(16rem, 0.75fr); }
}
</style>
