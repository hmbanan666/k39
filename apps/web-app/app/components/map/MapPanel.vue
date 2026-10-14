<template>
  <div
    class="dock"
    :class="{ collapsed, mobile }"
  >
    <aside
      ref="root"
      class="panel"
      :class="[snap, { detail: mode === 'place' || mode === 'route' }]"
      :data-panel="mode"
    >
      <button
        v-if="mobile"
        class="handle"
        type="button"
        aria-label="Высота панели"
        @pointerdown="dragStart"
        @pointerup="dragEnd"
        @pointercancel="dragEnd"
      />
      <div class="scroll">
        <div
          v-if="mode === 'place' && card"
          class="detail"
        >
          <button
            class="back"
            type="button"
            aria-label="Назад"
            @click="emit('back')"
          >
            <Icon :name="tablerIcon('back')" size="18" />
          </button>
          <img
            class="hero"
            :src="card.photo || markerArt(card.marker)"
            alt=""
          >
          <div class="copy">
            <p
              v-if="card.partner"
              class="partner"
            >
              Партнёр
            </p>
            <h2>{{ card.title }}</h2>
            <p class="meta">
              {{ card.kindLabel }}<template v-if="card.distance">
                · {{ card.distance }}
              </template>
              <template v-if="card.stale">
                · Давно не проверяли
              </template>
            </p>
            <p
              v-if="card.summary"
              class="sum"
            >
              {{ card.summary }}
            </p>
            <p
              v-if="card.address"
              class="fact"
            >
              {{ card.address }}
            </p>
            <p
              v-if="card.hours"
              class="fact"
            >
              {{ card.hours }}
            </p>
            <UiButton
              class="open"
              :href="card.href"
            >
              Открыть
            </UiButton>
          </div>
        </div>

        <div
          v-else-if="mode === 'route' && opened"
          class="detail"
        >
          <button
            class="back"
            type="button"
            aria-label="Назад"
            @click="emit('back')"
          >
            <Icon :name="tablerIcon('back')" size="18" />
          </button>
          <img
            class="hero"
            :src="routeThumb(opened) || markerArt('forty')"
            alt=""
          >
          <div class="copy">
            <p class="kicker">
              Маршрут
            </p>
            <h2>{{ opened.title }}</h2>
            <p class="meta">
              <template v-if="routeDurationLabel(opened)">
                {{ routeDurationLabel(opened) }} ·
              </template>
              {{ stopsLabel(opened.stops.length) }}
            </p>
            <p
              v-if="opened.summary"
              class="sum"
            >
              {{ opened.summary }}
            </p>
            <UiButton
              class="open"
              :href="opened.href"
            >
              Открыть
            </UiButton>
          </div>
          <h3>Остановки</h3>
          <ol class="stops">
            <li
              v-for="stop in routeStops"
              :key="stop.id"
            >
              <button
                type="button"
                :aria-current="selectedId === stop.id ? 'true' : undefined"
                @click="emit('selectPoint', stop.id)"
              >
                <span class="num">{{ stop.n }}</span>
                <img
                  :src="stop.photo || markerArt('forty')"
                  alt=""
                >
                <span>
                  <b>{{ stop.title }}</b>
                  <small v-if="stop.summary">{{ stop.summary }}</small>
                </span>
              </button>
            </li>
          </ol>
        </div>

        <template v-else>
          <div class="head">
            <form
              role="search"
              @submit.prevent
            >
              <label class="search">
                <span class="sr">Название</span>
                <Icon :name="tablerIcon('search')" size="18" />
                <input
                  :value="state.q"
                  type="search"
                  placeholder="Название"
                  enterkeyhint="search"
                  @input="onSearch"
                >
              </label>
            </form>
            <div class="cats">
              <button
                v-for="item in categories"
                :key="item.id"
                type="button"
                class="cat"
                :aria-pressed="category === item.id"
                @click="emit('category', item.id)"
              >
                <Icon :name="tablerIcon(item.id)" size="16" />
                {{ item.label }}
              </button>
            </div>
            <div class="subs">
              <button
                type="button"
                class="sub"
                :aria-pressed="openNow"
                @click="emit('toggleOpen')"
              >
                Открыто сейчас
              </button>
            </div>
            <div
              v-if="category === 'sights' && sightChips.length"
              class="subs"
            >
              <button
                v-for="item in sightChips"
                :key="item.id"
                type="button"
                class="sub"
                :aria-pressed="sightOn(item.id)"
                @click="emit('toggleSight', item.id)"
              >
                {{ item.label }}
                <span>{{ item.count }}</span>
              </button>
            </div>
            <div
              v-else-if="category === 'food' && foodChips.length"
              class="subs"
            >
              <button
                v-for="item in foodChips"
                :key="item.id"
                type="button"
                class="sub"
                :aria-pressed="foodOn(item.id)"
                @click="emit('toggleFood', item.id)"
              >
                {{ item.label }}
                <span>{{ item.count }}</span>
              </button>
            </div>
          </div>

          <section
            v-if="mode === 'home'"
            class="shelf"
          >
            <h2>Стоит увидеть</h2>
            <ul class="rows">
              <li
                v-for="point in suggestions"
                :key="point.id"
              >
                <button
                  type="button"
                  @click="emit('selectPoint', point.id)"
                >
                  <img
                    :src="point.photo || markerArt(point.marker)"
                    alt=""
                  >
                  <span>
                    <b>{{ point.title }}</b>
                    <small>{{ point.kindLabel }}</small>
                  </span>
                </button>
              </li>
            </ul>
            <template v-if="featured.length">
              <h2>Маршруты</h2>
              <ul class="rows">
                <li
                  v-for="item in featured"
                  :key="item.slug"
                >
                  <button
                    type="button"
                    @click="emit('selectRoute', item.slug)"
                  >
                    <img
                      :src="routeThumb(item) || markerArt('forty')"
                      alt=""
                    >
                    <span>
                      <b>{{ item.title }}</b>
                      <small>
                        <template v-if="routeDurationLabel(item)">
                          {{ routeDurationLabel(item) }} ·
                        </template>
                        {{ stopsLabel(item.stops.length) }}
                      </small>
                    </span>
                  </button>
                </li>
              </ul>
            </template>
          </section>

          <section
            v-else-if="mode === 'routes'"
            class="shelf"
          >
            <h2>Маршруты</h2>
            <p
              v-if="routeCards.nearby"
              class="note"
            >
              В этой области маршрутов нет. Все опубликованные:
            </p>
            <ul class="rows">
              <li
                v-for="item in routeCards.items"
                :key="item.slug"
              >
                <button
                  type="button"
                  @click="emit('selectRoute', item.slug)"
                >
                  <img
                    :src="routeThumb(item) || markerArt('forty')"
                    alt=""
                  >
                  <span>
                    <b>{{ item.title }}</b>
                    <small>
                      <template v-if="routeDurationLabel(item)">
                        {{ routeDurationLabel(item) }} ·
                      </template>
                      {{ stopsLabel(item.stops.length) }}
                    </small>
                  </span>
                </button>
              </li>
            </ul>
          </section>

          <section
            v-else
            class="shelf"
          >
            <h2>{{ state.q ? 'Нашлось' : 'В этой области' }}</h2>
            <p
              v-if="results.nearby"
              class="note"
            >
              Рядом с этой областью
            </p>
            <ul class="rows">
              <li
                v-for="point in results.items"
                :key="point.id"
              >
                <button
                  type="button"
                  :aria-current="selectedId === point.id ? 'true' : undefined"
                  @click="emit('selectPoint', point.id)"
                >
                  <img
                    :src="point.photo || markerArt(point.marker)"
                    alt=""
                  >
                  <span>
                    <b>{{ point.title }}</b>
                    <small>
                      {{ point.kindLabel }}
                      <template v-if="point.partner">
                        · Партнёр
                      </template>
                      <template v-if="away(point)">
                        · {{ away(point) }}
                      </template>
                    </small>
                  </span>
                </button>
              </li>
              <li
                v-if="!results.items.length"
                class="empty"
              >
                {{ state.q ? 'Ничего не нашлось' : 'В этой области ничего нет' }}
              </li>
            </ul>
          </section>
        </template>
      </div>
    </aside>
    <button
      v-if="!mobile"
      class="fold"
      type="button"
      :aria-expanded="collapsed ? 'false' : 'true'"
      :aria-label="collapsed ? 'Открыть панель' : 'Свернуть панель'"
      @click="emit('collapse')"
    >
      <Icon :name="tablerIcon(collapsed ? 'open' : 'close')" size="18" />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { BrowseCategory, MapBounds, MapOrigin, MapPoint, MapQueryState, MapRoute, SightId } from '~~/shared/map'
import { tablerIcon } from '~~/shared/icons'
import {
  activeCategory,
  boundsCenter,
  BROWSE_CATEGORIES,
  browseCounts,
  browseList,
  curatedSights,
  distanceKm,
  facetCounts,
  FOOD_FILTERS,
  formatDistance,
  inBounds,
  markerArt,
  pointInCategory,
  popularRoutes,
  routeDurationLabel,
  routeOverlay,
  routeThumb,
  SIGHT_BROWSE,
  stopsLabel,
} from '~~/shared/map'

const props = defineProps<{
  points: MapPoint[]
  routes: MapRoute[]
  state: MapQueryState
  selectedId: string | null
  bounds: MapBounds | null
  origin: MapOrigin | null
  collapsed: boolean
  mobile: boolean
  snap: 'peek' | 'half' | 'full'
  openNow?: boolean
}>()

const emit = defineEmits<{
  search: [value: string]
  category: [id: BrowseCategory]
  toggleSight: [id: SightId]
  toggleFood: [id: string]
  toggleOpen: []
  selectPoint: [id: string]
  selectRoute: [slug: string]
  back: []
  collapse: []
  snap: [snap: 'peek' | 'half' | 'full']
  metrics: [size: { width: number, height: number }]
}>()

const root = ref<HTMLElement | null>(null)
const counts = computed(() => facetCounts(props.points))
const category = computed(() => activeCategory(props.state))
const opened = computed(() => props.routes.find((item) => item.slug === props.state.route) || null)
const routeStops = computed(() => (opened.value ? routeOverlay(opened.value)?.stops ?? [] : []).map((stop) => ({
  id: stop.id,
  n: stop.position,
  title: stop.title,
  summary: stop.summary,
  photo: stop.photo,
  href: stop.href,
})))

const categories = computed(() => {
  const totals = browseCounts(props.points, props.routes.length)
  return BROWSE_CATEGORIES.flatMap((item) => {
    if (!totals[item.id]) {
      return []
    }
    return [item]
  })
})

const sightChips = computed(() => SIGHT_BROWSE.flatMap((item) => {
  const count = counts.value.sights[item.id] || 0
  return count ? [{ ...item, count }] : []
}))

const foodChips = computed(() => {
  const chips: Array<{ id: string, label: string, count: number }> = FOOD_FILTERS.map((item) => ({
    id: item.id,
    label: item.label,
    count: counts.value.food[item.id] || 0,
  }))
  if (counts.value.food.eda) {
    chips.push({ id: 'eda', label: 'Еда', count: counts.value.food.eda })
  }
  return chips.filter((item) => item.count > 0)
})

const suggestions = computed(() => curatedSights(props.points))
const featured = computed(() => popularRoutes(props.routes))

const focus = computed<MapOrigin | null>(() => props.origin || (props.bounds ? boundsCenter(props.bounds) : null))

const results = computed(() => {
  let pool = props.points
  const current = category.value
  if (current && current !== 'routes') {
    pool = pool.filter((point) => pointInCategory(point, current, props.state))
  }
  const query = props.state.q.trim().toLocaleLowerCase('ru')
  if (query) {
    pool = pool.filter((point) => `${point.title} ${point.kindLabel} ${point.address || ''}`.toLocaleLowerCase('ru').includes(query))
  }
  return browseList(pool, props.bounds, focus.value, props.state.q)
})

const routeCards = computed(() => {
  const items = [...props.routes].sort((a, b) => a.title.localeCompare(b.title, 'ru'))
  const box = props.bounds
  if (!box) {
    return { items, nearby: false }
  }
  const inside = items.filter((item) => item.stops.some((stop) => Number.isFinite(stop.latitude) && inBounds(stop, box)))
  if (inside.length) {
    return { items: inside, nearby: false }
  }
  return { items, nearby: true }
})

const card = computed(() => {
  const id = props.selectedId
  if (!id) {
    return null
  }
  const point = props.points.find((item) => item.id === id)
  if (point) {
    return { ...point, distance: away(point) }
  }
  const route = opened.value
  if (!route) {
    return null
  }
  const stop = routeOverlay(route)?.stops.find((item) => item.id === id)
  if (!stop) {
    return null
  }
  return {
    title: stop.title,
    href: stop.href,
    kindLabel: `Остановка ${stop.position}`,
    summary: stop.summary,
    photo: stop.photo,
    marker: 'forty',
    partner: false,
    stale: false,
    address: null,
    hours: null,
    distance: away(stop),
  }
})

const mode = computed(() => {
  if (card.value) {
    return 'place'
  }
  if (opened.value) {
    return 'route'
  }
  if (category.value === 'routes') {
    return 'routes'
  }
  if (category.value || props.state.q.trim()) {
    return 'results'
  }
  return 'home'
})

function sightOn(id: SightId) {
  return props.state.sights == null || props.state.sights.includes(id)
}

function foodOn(id: string) {
  return props.state.food == null || props.state.food.includes(id)
}

function away(point: { latitude: number, longitude: number }) {
  const from = focus.value
  if (!from || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
    return ''
  }
  return formatDistance(distanceKm(from.latitude, from.longitude, point.latitude, point.longitude))
}

function onSearch(event: Event) {
  emit('search', (event.target as HTMLInputElement).value)
}

function publishSize() {
  const node = root.value
  if (!node) {
    return
  }
  emit('metrics', {
    width: props.collapsed || props.mobile ? 0 : node.offsetWidth,
    height: node.offsetHeight,
  })
}

let observer: ResizeObserver | undefined
let dragY = 0

function dragStart(event: PointerEvent) {
  dragY = event.clientY
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function dragEnd(event: PointerEvent) {
  const snaps = ['peek', 'half', 'full'] as const
  const index = snaps.indexOf(props.snap)
  const delta = event.clientY - dragY
  let next = index
  if (Math.abs(delta) < 8) {
    next = (index + 1) % snaps.length
  } else if (delta > 48) {
    next = Math.max(0, index - 1)
  } else {
    next = Math.min(snaps.length - 1, index + 1)
  }
  const snap = snaps[next]
  if (snap && snap !== props.snap) {
    emit('snap', snap)
  }
}

onMounted(() => {
  publishSize()
  const node = root.value
  if (node && 'ResizeObserver' in window) {
    observer = new ResizeObserver(() => publishSize())
    observer.observe(node)
  }
})

onBeforeUnmount(() => observer?.disconnect())

watch(() => [props.collapsed, props.mobile, props.snap], () => publishSize())
</script>

<style scoped>
.dock {
  position: absolute;
  z-index: 5;
  top: 0;
  bottom: 0;
  left: 0;
  width: 26.5rem;
  pointer-events: none;
}
.panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  border-right: 1px solid var(--color-line);
  background: var(--color-surface);
  box-shadow: 8px 0 24px rgb(43 36 32 / 6%);
}
.dock.collapsed { width: 0; }
.dock.collapsed .panel {
  width: 0;
  overflow: hidden;
  border: 0;
  box-shadow: none;
}
.scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.95rem 1rem 1.3rem;
}
.head {
  position: sticky;
  top: -0.95rem;
  z-index: 1;
  margin: -0.95rem -1rem 0.35rem;
  padding: 0.95rem 1rem 0.7rem;
  background: var(--color-surface);
}
.search { position: relative; display: block; }
.search input {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.4rem 0.8rem 0.4rem 2.35rem;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  background: var(--color-paper);
  color: var(--color-ink);
  font: 400 1rem/1.3 var(--font-body);
}
.search :deep(svg) {
  position: absolute;
  top: 0.78rem;
  left: 0.75rem;
  width: 1rem;
  height: 1rem;
  color: var(--muted);
}
.cats, .subs {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.7rem;
  overflow-x: auto;
}
.subs { margin-top: 0.45rem; }
.cat, .sub {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.35rem;
  min-height: 2.15rem;
  padding: 0.2rem 0.7rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--color-paper);
  color: var(--color-ink);
  font: 600 0.84rem/1 var(--font-body);
  cursor: pointer;
}
.cat[aria-pressed="true"], .sub[aria-pressed="true"] {
  border-color: var(--color-brick);
  background: var(--color-brick);
  color: var(--color-paper);
}
.sub { min-height: 1.85rem; font-size: 0.78rem; }
.sub span { opacity: 0.72; font-weight: 500; font-variant-numeric: tabular-nums; }
.shelf h2, .detail h3 {
  margin: 0.85rem 0 0.35rem;
  color: var(--muted);
  font-family: var(--font-stamp);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.rows, .stops { display: grid; gap: 0.15rem; margin: 0; padding: 0; list-style: none; }
.rows button, .stops button {
  display: flex;
  gap: 0.7rem;
  align-items: center;
  width: 100%;
  padding: 0.4rem 0.2rem;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.rows button:hover, .stops button:hover, .rows button[aria-current="true"] { background: var(--color-paper); }
.rows img, .stops img {
  width: 3.4rem;
  height: 3.4rem;
  object-fit: cover;
  border-radius: 10px;
  background: var(--color-sand);
}
.rows b, .stops b {
  display: block;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.2;
}
.rows small, .stops small {
  display: block;
  margin-top: 0.12rem;
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.3;
}
.note, .empty { margin: 0.2rem 0 0.5rem; color: var(--muted); font-size: 0.88rem; }
.detail { display: grid; gap: 0.75rem; }
.back {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--color-paper);
  color: var(--color-ink);
  cursor: pointer;
}
.hero {
  width: 100%;
  height: 11.5rem;
  object-fit: cover;
  border-radius: 14px;
  background: var(--color-sand);
}
.copy h2 {
  margin: 0;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 1.7rem;
  line-height: 1.1;
}
.kicker, .meta, .sum, .fact { margin: 0.25rem 0 0; }
.kicker {
  color: var(--color-sea);
  font-family: var(--font-stamp);
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.meta, .sum, .fact { color: var(--muted); font-size: 0.92rem; line-height: 1.4; }
.fact { color: var(--color-ink); }
.open { margin-top: 0.7rem; }
.partner {
  display: inline-block;
  margin: 0;
  padding: 0.05rem 0.4rem;
  border-radius: 3px;
  background: var(--color-amber-soft);
  color: var(--color-partner);
  font-family: var(--font-stamp);
  font-size: 0.78rem;
}
.num {
  display: grid;
  place-items: center;
  flex: none;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 999px;
  background: var(--color-brick);
  color: var(--color-paper);
  font-size: 0.78rem;
  font-weight: 700;
}
.fold {
  position: absolute;
  z-index: 4;
  top: 50%;
  left: 100%;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  margin-left: 0.55rem;
  padding: 0;
  pointer-events: auto;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-ink);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transform: translateY(-50%);
}
.dock.collapsed .fold {
  left: 0.75rem;
  margin-left: 0;
}
.handle { display: none; }
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
@media (max-width: 720px) {
  .dock {
    top: auto;
    right: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    width: auto;
    height: 100%;
  }
  .panel {
    width: 100%;
    height: 11.75rem;
    border-right: 0;
    border-top: 1px solid var(--color-line);
    border-radius: 18px 18px 0 0;
    box-shadow: 0 -10px 28px rgb(43 36 32 / 12%);
    transition: height var(--duration) var(--ease);
  }
  .panel.half { height: min(52dvh, 28rem); }
  .panel.full { height: calc(100% - 4.25rem); }
  .handle {
    display: grid;
    place-items: center;
    flex: none;
    height: 1.35rem;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: grab;
    touch-action: none;
  }
  .handle::before {
    content: "";
    width: 2.4rem;
    height: 0.28rem;
    border-radius: 99px;
    background: var(--color-line);
  }
  .hero { height: 9.5rem; }
}
@media (prefers-reduced-motion: reduce) {
  .panel { transition: none; }
}
</style>
