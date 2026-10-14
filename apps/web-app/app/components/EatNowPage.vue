<template>
  <article class="page page-wide eat-now">
    <PageHeader
      :h1="page.doc.h1"
      :crumbs="page.doc.crumbs"
      kicker="Еда"
      :lede="page.doc.description"
    />
    <nav
      class="towns"
      aria-label="Города"
    >
      <a
        v-for="town in page.towns"
        :key="town.slug"
        :href="town.href"
        :aria-current="page.type === 'town' && town.slug === page.town.slug ? 'page' : undefined"
      >{{ town.title }} <span>{{ town.count }}</span></a>
    </nav>
    <template v-if="page.type === 'town'">
      <div class="tools">
        <p class="note">
          {{ originNote }}
        </p>
        <button
          v-if="canLocate"
          type="button"
          class="btn btn-line"
          :disabled="locating"
          @click="locate"
        >
          {{ origin ? 'Обновить моё место' : 'Ближе ко мне' }}
        </button>
      </div>
      <!-- Server HTML: the whole list by distance. After hydration the browser
           splits it by live status (ADR 0029). -->
      <section
        v-for="group in groups"
        :key="group.key"
        class="group"
      >
        <h2 v-if="group.title">
          {{ group.title }} <span class="count">{{ group.items.length }}</span>
        </h2>
        <VenueNearby
          :items="group.items"
          title=""
          layout="grid"
        />
      </section>
      <p class="note">
        Статус считается по проверенным часам в момент открытия страницы. Перед поездкой лучше позвонить.
      </p>
    </template>
  </article>
</template>

<script setup lang="ts">
import type { EatNowGroup } from '~~/shared/eat-now'
import type { PublicMedia } from '~~/shared/media'
import type { ScheduleRecord } from '~~/shared/schedule'
import type { SeoDocument } from '~~/shared/seo'
import { clientDistance, clientWalk, groupEatNow, haversineKm } from '~~/shared/eat-now'
import { statusFromRules } from '~~/shared/schedule'

interface EatNowItem {
  href: string
  slug: string
  name: string
  kindLabel: string
  cuisine: string[]
  price: string
  check: string
  address: string | null
  latitude: number | null
  longitude: number | null
  distanceKm: number | null
  distance: string
  walk?: string
  stale: boolean
  partner?: boolean
  media: PublicMedia | null
  schedule: ScheduleRecord | null
}

export type EatNowData
  = | { type: 'index', doc: SeoDocument, towns: Array<{ slug: string, title: string, href: string, count: number }> }
    | {
      type: 'town'
      doc: SeoDocument
      town: { slug: string, title: string, where: string }
      centre: { latitude: number, longitude: number } | null
      towns: Array<{ slug: string, title: string, href: string, count: number }>
      items: EatNowItem[]
    }

const props = defineProps<{ page: EatNowData }>()

const origin = ref<{ latitude: number, longitude: number } | null>(null)
const statuses = ref<Record<string, EatNowGroup> | null>(null)
const locating = ref(false)
const canLocate = ref(false)

const items = computed(() => {
  if (props.page.type !== 'town') {
    return []
  }
  const from = origin.value
  return props.page.items.map((item) => {
    if (!from || item.latitude == null || item.longitude == null) {
      return { ...item, partner: false }
    }
    const distanceKm = haversineKm(from, { latitude: item.latitude, longitude: item.longitude })
    return { ...item, partner: false, distanceKm, distance: clientDistance(distanceKm), walk: clientWalk(distanceKm) }
  })
})

const groups = computed(() => {
  const map = statuses.value
  if (!map) {
    return [{ key: 'all', title: '', items: items.value }]
  }
  return groupEatNow(items.value, (item) => map[item.slug] ?? 'unknown')
})

const originNote = computed(() => {
  if (props.page.type !== 'town') {
    return ''
  }
  return origin.value ? 'Расстояние от вас, по прямой.' : `Расстояние от центра, по прямой. ${props.page.town.title}.`
})

function refreshStatuses() {
  if (props.page.type !== 'town') {
    return
  }
  const now = new Date()
  const next: Record<string, EatNowGroup> = {}
  for (const item of props.page.items) {
    const value = statusFromRules(item.schedule, now)
    next[item.slug] = value.status === 'open' || value.status === 'closing_soon'
      ? 'open'
      : value.status === 'unknown' ? 'unknown' : 'later'
  }
  statuses.value = next
}

function locate() {
  locating.value = true
  navigator.geolocation.getCurrentPosition((position) => {
    origin.value = { latitude: position.coords.latitude, longitude: position.coords.longitude }
    locating.value = false
  }, () => {
    locating.value = false
  }, { maximumAge: 300_000, timeout: 10_000 })
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  canLocate.value = 'geolocation' in navigator
  refreshStatuses()
  timer = setInterval(refreshStatuses, 60_000)
})
onBeforeUnmount(() => clearInterval(timer))

usePublicHead(props.page.doc)
</script>

<style scoped>
.towns { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0 0 1.5rem; }
.towns a {
  padding: 0.3rem 0.8rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  text-decoration: none;
}
.towns a span { color: var(--muted); font-size: var(--step--1); }
.towns a[aria-current='page'] { border-color: var(--accent); color: var(--accent); font-weight: 700; }
.tools { display: flex; flex-wrap: wrap; gap: 0.6rem 1rem; align-items: center; justify-content: space-between; margin-bottom: 1.2rem; }
.note { margin: 0; color: var(--muted); font-size: var(--step--1); }
.group { margin-bottom: 2.4rem; }
.group h2 { margin: 0 0 1rem; }
.count { color: var(--muted); font-size: 0.7em; }
</style>
