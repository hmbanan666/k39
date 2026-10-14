<template>
  <div class="visitor-map">
    <h1 class="sr">
      {{ page.doc.h1 }}
    </h1>
    <K39Map
      v-model:selected="selectedId"
      :points="visible"
      :overlay="overlay"
      :fit-key="fitKey"
      :lazy="false"
      :card-visible="false"
      :padding="padding"
      :controls-bottom="controlsBottom"
      map-label="Карта Калининградской области"
      @bounds="onBounds"
      @located="onLocated"
    />
    <MapPanel
      :points="panelPoints"
      :routes="page.routes"
      :open-now="openNow"
      :state="state"
      :selected-id="selectedId"
      :bounds="bounds"
      :origin="origin"
      :collapsed="collapsed"
      :mobile="mobile"
      :snap="snap"
      @search="state.q = $event"
      @category="chooseCategory"
      @toggle-sight="toggleSight"
      @toggle-food="toggleFood"
      @toggle-open="toggleOpen"
      @select-point="choosePoint"
      @select-route="chooseRoute"
      @back="back"
      @collapse="collapsed = !collapsed"
      @snap="snap = $event"
      @metrics="onMetrics"
    />
  </div>
</template>

<script setup lang="ts">
import type { BrowseCategory, MapBounds, MapOrigin, MapPoint, MapQueryState, MapRoute, SightId } from '~~/shared/map'
import type { SeoDocument } from '~~/shared/seo'
import type { MapFramePadding } from '~/lib/mount-k39-map'
import {
  activeCategory,
  boundsCenter,
  focusMatch,
  FOOD_FILTERS,
  foodIdsIn,
  mapQueryRecord,
  parseMapQuery,
  queriesEqual,
  routeFocusSlug,
  routeOverlay,
  shownPoints,
  SIGHT_BROWSE,
  toggleId,
} from '~~/shared/map'
import K39Map from '~/components/map/K39Map.vue'
import MapPanel from '~/components/map/MapPanel.vue'

const route = useRoute()
const router = useRouter()
const page = await fetchPublic<{
  doc: SeoDocument
  points: MapPoint[]
  routes: MapRoute[]
}>('/api/public/map')
usePublicHead(page.doc)

const foodAll = foodIdsIn(page.points)
const parsed = parseMapQuery(route.query)
const linkedRoute = routeFocusSlug(parsed.focus)
if (linkedRoute && page.routes.some((item) => item.slug === linkedRoute)) {
  parsed.category = 'routes'
  parsed.route = linkedRoute
}
const state = ref<MapQueryState>(parsed)
const selectedId = ref<string | null>(page.points.find((point) => focusMatch(point, parsed.focus))?.id ?? null)
const bounds = ref<MapBounds | null>(null)
const userOrigin = ref<MapOrigin | null>(null)
const collapsed = ref(false)
const mobile = ref(false)
const snap = ref<'peek' | 'half' | 'full'>('peek')
const panelWidth = ref(424)
const sheetHeight = ref(180)

// «Открыто сейчас» is computed in the browser from /api/public/availability,
// never in the cached HTML. Only verified schedules count.
const openNow = ref(false)
const openKeys = ref<Set<string> | null>(null)
const isOpen = (point: MapPoint) => openKeys.value?.has(`${point.group === 'food' ? 'venue' : 'place'}:${point.slug}`) ?? false
const panelPoints = computed(() => (openNow.value ? page.points.filter(isOpen) : page.points))
const visible = computed(() => {
  if (!openNow.value) {
    return shownPoints(page.points, state.value)
  }
  const plain = !state.value.q.trim() && !activeCategory(state.value)
  return plain ? panelPoints.value : shownPoints(page.points, state.value).filter(isOpen)
})

async function toggleOpen() {
  openNow.value = !openNow.value
  if (openNow.value) {
    const result = await $fetch<{ items: Array<{ type: string, slug: string }> }>('/api/public/availability', { query: { status: 'open,closing_soon' } }).catch(() => ({ items: [] }))
    openKeys.value = new Set(result.items.map((item) => `${item.type}:${item.slug}`))
  }
}
const selectedRoute = computed(() => page.routes.find((item) => item.slug === state.value.route) || null)
const overlay = computed(() => routeOverlay(selectedRoute.value))
const fitKey = computed(() => `${activeCategory(state.value) || ''}|${state.value.route || ''}`)
const origin = computed(() => userOrigin.value || (bounds.value ? boundsCenter(bounds.value) : null))
const noticeOffset = ref(0)
const padding = computed<MapFramePadding>(() => {
  const sheet = mobile.value ? Math.min(sheetHeight.value, 280) + 12 : 28
  const lift = mobile.value || collapsed.value ? noticeOffset.value : 0
  return {
    top: 16,
    right: 72,
    bottom: sheet + lift,
    left: mobile.value ? 16 : (collapsed.value ? 16 : panelWidth.value + 8),
  }
})
const controlsBottom = computed(() => {
  if (!mobile.value) {
    return '0.6rem'
  }
  const lift = ' + var(--cookie-notice-offset, 0px)'
  if (snap.value === 'full') {
    return 'calc(100% - 4.6rem)'
  }
  if (snap.value === 'half') {
    return `calc(min(52dvh, 28rem) + 2.4rem${lift})`
  }
  return `calc(14rem${lift})`
})

function readNoticeOffset() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--cookie-notice-offset').trim()
  const value = Number.parseFloat(raw)
  noticeOffset.value = Number.isFinite(value) ? value : 0
}

function chooseCategory(id: BrowseCategory) {
  selectedId.value = null
  state.value.focus = null
  const current = activeCategory(state.value)
  state.value.sights = null
  state.value.food = null
  state.value.route = null
  state.value.category = current === id ? null : id
  if (mobile.value && snap.value === 'peek' && state.value.category) {
    snap.value = 'half'
  }
}

function toggleSight(id: SightId) {
  state.value.category = 'sights'
  state.value.sights = toggleId(state.value.sights, id, SIGHT_BROWSE.map((item) => item.id)) as SightId[] | null
}

function toggleFood(id: string) {
  state.value.category = 'food'
  state.value.food = toggleId(state.value.food, id, foodAll.length ? foodAll : FOOD_FILTERS.map((item) => item.id))
}

function choosePoint(id: string) {
  selectedId.value = id
  if (mobile.value && snap.value === 'peek') {
    snap.value = 'half'
  }
}

function chooseRoute(slug: string) {
  selectedId.value = null
  state.value.focus = null
  state.value.category = 'routes'
  state.value.sights = null
  state.value.food = null
  state.value.route = slug
  if (mobile.value) {
    snap.value = 'half'
  }
}

function back() {
  if (selectedId.value) {
    selectedId.value = null
    state.value.focus = null
    return
  }
  if (state.value.route) {
    state.value.route = null
    state.value.category = 'routes'
    return
  }
  if (state.value.q) {
    state.value.q = ''
    return
  }
  state.value.category = null
  state.value.sights = null
  state.value.food = null
}

function onBounds(next: MapBounds) {
  bounds.value = next
}

function onLocated(point: MapOrigin) {
  userOrigin.value = point
}

function onMetrics(size: { width: number, height: number }) {
  if (!mobile.value && size.width > 0) {
    panelWidth.value = size.width
  }
  if (mobile.value) {
    sheetHeight.value = size.height
  }
}

function syncChrome() {
  mobile.value = window.matchMedia('(max-width: 720px)').matches
}

function syncPanelVar() {
  const width = mobile.value || collapsed.value ? 0 : panelWidth.value
  document.documentElement.style.setProperty('--map-panel', `${width}px`)
}

let noticeObserver: MutationObserver | undefined

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
  void router.replace({ path: '/map', query: next })
}, { deep: true })

watch([collapsed, mobile, panelWidth], () => syncPanelVar())

onMounted(() => {
  useTrack().track('page_view')
  syncChrome()
  syncPanelVar()
  readNoticeOffset()
  noticeObserver = new MutationObserver(() => readNoticeOffset())
  noticeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
  window.addEventListener('resize', syncChrome)
})

onBeforeUnmount(() => {
  noticeObserver?.disconnect()
  window.removeEventListener('resize', syncChrome)
  document.documentElement.style.removeProperty('--map-panel')
})
</script>

<style scoped>
.visitor-map {
  position: relative;
  height: calc(100dvh - var(--site-header-offset));
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
@media (min-width: 900px) {
  .visitor-map { height: calc(100dvh - var(--site-header-offset)); }
}
</style>

<style>
html:has(.visitor-map),
body:has(.visitor-map) {
  height: 100%;
  overflow: clip;
}
body:has(.visitor-map) .site-footer { margin-top: 0; }
body:has([aria-label="Уведомление о cookie"]) .dock {
  bottom: var(--cookie-notice-offset, 0px);
}
</style>
