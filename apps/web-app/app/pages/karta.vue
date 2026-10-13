<template>
  <div class="karta">
    <h1 class="sr">
      {{ page.doc.h1 }}
    </h1>
    <K39Map
      v-model:selected="selectedId"
      :points="visible"
      :overlay="overlay"
      :fit-key="fitKey"
      :lazy="false"
      aria-label="Карта Калининградской области"
    />
    <form
      class="panel"
      :class="{ listed: listOpen }"
      role="search"
      @submit.prevent
    >
      <label class="search-label">
        <span class="sr">Название</span>
        <input
          v-model="state.q"
          class="search"
          type="search"
          placeholder="Название"
          enterkeyhint="search"
        >
      </label>
      <fieldset>
        <legend>Достопримечательности</legend>
        <div class="chips">
          <button
            v-for="facet in SIGHT_FACETS"
            :key="facet.id"
            type="button"
            class="chip"
            :aria-pressed="sightOn(facet.id)"
            @click="toggleSight(facet.id)"
          >
            <MapGlyph :name="facet.id" />
            {{ facet.label }}
            <span class="count">{{ counts.sights[facet.id] }}</span>
          </button>
        </div>
      </fieldset>
      <fieldset>
        <legend>Где поесть</legend>
        <div class="chips">
          <button
            v-for="facet in foodFacets"
            :key="facet.id"
            type="button"
            class="chip"
            :aria-pressed="foodOn(facet.id)"
            @click="toggleFood(facet.id)"
          >
            <MapGlyph :name="facet.id" />
            {{ facet.label }}
            <span class="count">{{ counts.food[facet.id] || 0 }}</span>
          </button>
        </div>
      </fieldset>
      <label class="route">
        <span>Маршрут</span>
        <select
          :value="state.route || ''"
          @change="setRoute"
        >
          <option value="">
            Не выбран
          </option>
          <option
            v-for="item in page.routes"
            :key="item.slug"
            :value="item.slug"
          >
            {{ item.title }}
          </option>
        </select>
      </label>
      <button
        class="list-toggle"
        type="button"
        :aria-expanded="listOpen"
        @click="listOpen = !listOpen"
      >
        {{ listOpen ? 'Карта' : 'Список' }}
        <span class="count">{{ visible.length }}</span>
      </button>
      <ul class="list">
        <li
          v-for="point in visible"
          :key="point.id"
        >
          <a
            :href="point.href"
            :aria-current="selectedId === point.id ? 'true' : undefined"
            @click.prevent="choose(point.id)"
          >
            <MapGlyph :name="point.marker" />
            <span>
              <b>{{ point.title }}</b>
              <small>{{ point.kindLabel }}</small>
            </span>
          </a>
        </li>
        <li
          v-if="overlay"
          class="route-link"
        >
          <a :href="selectedRoute?.href || '/marshruty'">Маршрут на странице</a>
        </li>
        <li
          v-if="!visible.length"
          class="empty"
        >
          Ничего не нашлось
        </li>
      </ul>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { MapPoint, MapQueryState, MapRoute, SightId } from '~~/shared/map'
import type { SeoDocument } from '~~/shared/seo'
import {
  facetCounts,
  FOOD_FILTERS,
  foodIdsIn,
  mapQueryRecord,
  parseMapQuery,
  pointVisible,
  queriesEqual,
  routeOverlay,
  SIGHT_FACETS,
  sortMapPoints,
  toggleId,
} from '~~/shared/map'
import K39Map from '~/components/map/K39Map.vue'
import MapGlyph from '~/components/map/MapGlyph.vue'

const route = useRoute()
const router = useRouter()
const page = await fetchPublic<{
  doc: SeoDocument
  points: MapPoint[]
  routes: MapRoute[]
}>('/api/public/map')
usePublicHead(page.doc)

const foodAll = foodIdsIn(page.points)
const state = ref<MapQueryState>(parseMapQuery(route.query))
const selectedId = ref<string | null>(null)
const listOpen = ref(false)
const counts = facetCounts(page.points)
const foodFacets = [
  ...FOOD_FILTERS,
  ...(counts.food.eda ? [{ id: 'eda', label: 'Еда' }] : []),
]

const visible = computed(() => sortMapPoints(page.points.filter((point) => pointVisible(point, state.value))))
const selectedRoute = computed(() => page.routes.find((item) => item.slug === state.value.route) || null)
const overlay = computed(() => routeOverlay(selectedRoute.value))
const fitKey = computed(() => JSON.stringify(mapQueryRecord(state.value, foodAll)))

function sightOn(id: SightId) {
  return state.value.sights == null || state.value.sights.includes(id)
}

function foodOn(id: string) {
  return state.value.food == null || state.value.food.includes(id)
}

function toggleSight(id: SightId) {
  state.value.sights = toggleId(state.value.sights, id, SIGHT_FACETS.map((item) => item.id)) as SightId[] | null
}

function toggleFood(id: string) {
  state.value.food = toggleId(state.value.food, id, foodAll)
}

function setRoute(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  state.value.route = value || null
}

function choose(id: string) {
  selectedId.value = id
  listOpen.value = false
}

watch(() => route.query, (query) => {
  if (queriesEqual(mapQueryRecord(state.value, foodAll), query)) {
    return
  }
  state.value = parseMapQuery(query)
})

watch(state, (value) => {
  const next = mapQueryRecord(value, foodAll)
  if (queriesEqual(next, route.query)) {
    return
  }
  void router.replace({ path: '/karta', query: next })
}, { deep: true })

function syncHeader() {
  const header = document.querySelector('.site-header')
  if (!header) {
    return
  }
  document.documentElement.style.setProperty('--site-header-offset', `${header.getBoundingClientRect().height}px`)
}

let headerObserver: ResizeObserver | undefined

onMounted(() => {
  useTrack().track('page_view')
  syncHeader()
  const header = document.querySelector('.site-header')
  if (header && 'ResizeObserver' in window) {
    headerObserver = new ResizeObserver(() => syncHeader())
    headerObserver.observe(header)
  }
})

onBeforeUnmount(() => headerObserver?.disconnect())
</script>

<style scoped>
.karta {
  position: relative;
  height: calc(100dvh - var(--site-header-offset, 7.5rem));
  background: #efe6d4;
}
.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.panel {
  position: absolute;
  z-index: 3;
  top: 0.75rem;
  left: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  width: min(22.5rem, calc(100% - 4.6rem));
  max-height: calc(100% - 1.5rem);
  padding: 0.75rem;
  overflow: auto;
  border: 1px solid var(--color-line);
  border-radius: 16px;
  background: rgb(255 251 243 / 94%);
  box-shadow: var(--shadow-pop);
}
fieldset { margin: 0; padding: 0; border: 0; min-width: 0; }
legend {
  margin-bottom: 0.4rem;
  color: var(--muted);
  font-family: "Alegreya SC", serif;
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 2rem;
  padding: 0.15rem 0.55rem 0.15rem 0.4rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-ink);
  font: 600 0.82rem/1 var(--font-body);
  cursor: pointer;
}
.chip[aria-pressed="true"] {
  border-color: var(--color-brick);
  background: var(--color-brick);
  color: var(--color-paper);
}
.count { opacity: 0.72; font-weight: 500; font-variant-numeric: tabular-nums; }
.search, select {
  width: 100%;
  min-height: 2.4rem;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--color-line);
  border-radius: 10px;
  background: var(--color-paper);
  color: var(--color-ink);
  font: 400 0.95rem/1.3 var(--font-body);
}
.route { display: grid; gap: 0.25rem; color: var(--color-ink); font-size: 0.82rem; font-weight: 700; }
.list { display: grid; gap: 0.15rem; max-height: 34vh; margin: 0; padding: 0; overflow: auto; list-style: none; }
.list a {
  display: flex;
  gap: 0.45rem;
  align-items: center;
  padding: 0.35rem 0.2rem;
  color: inherit;
  text-decoration: none;
}
.list a[aria-current="true"] b { color: var(--color-brick); }
.list b { display: block; font-family: var(--font-display); font-size: 1rem; font-weight: 700; }
.list small { color: var(--muted); font-size: 0.78rem; }
.route-link a {
  display: inline;
  color: var(--color-sea);
  font-size: 0.9rem;
  text-decoration: underline;
}
.empty { color: var(--muted); }
.list-toggle { display: none; }
@media (min-width: 900px) {
  .karta { height: calc(100dvh - var(--site-header-offset, 4.75rem)); }
}
@media (max-width: 720px) {
  .panel {
    top: 0.5rem;
    right: 3.5rem;
    left: 0.5rem;
    width: auto;
    max-height: calc(100% - 1rem);
    padding: 0.5rem;
  }
  .chips { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 0.15rem; }
  .chip { flex: none; }
  .list { display: none; max-height: 42dvh; }
  .panel.listed .list { display: grid; }
  .list-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem;
    min-height: 2.3rem;
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--color-line);
    border-radius: 999px;
    background: var(--color-surface);
    color: var(--color-ink);
    font: 700 0.88rem/1 var(--font-body);
    cursor: pointer;
  }
}
</style>

<style>
body:has(.karta) .site-footer { margin-top: 0; }
</style>
