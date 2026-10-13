<template>
  <main class="admin">
    <h1>{{ venueId ? 'Заведение' : 'Новое заведение' }}</h1>
    <form
      class="stack"
      @submit.prevent="save"
    >
      <UiField label="Название">
        <UiInput
          v-model="form.name"
          required
        />
      </UiField>
      <UiField
        label="Адрес (slug)"
        :hint="slugProblem"
      >
        <UiInput
          v-model="form.slug"
          required
        />
      </UiField>
      <UiField label="Тип">
        <UiSelect
          v-model="form.kind"
          :options="kindOptions"
        />
      </UiField>
      <UiField label="Статус">
        <UiSelect
          v-model="form.status"
          :options="statusOptions"
        />
      </UiField>
      <UiField label="Регион">
        <UiSelect
          v-model="form.regionSlug"
          :options="regionOptions"
        />
      </UiField>
      <UiField label="Кухня, через запятую">
        <UiInput v-model="form.cuisine" />
      </UiField>
      <UiField label="Адрес">
        <UiInput v-model="form.address" />
      </UiField>
      <UiField label="Широта">
        <UiInput v-model="form.latitude" />
      </UiField>
      <UiField label="Долгота">
        <UiInput v-model="form.longitude" />
      </UiField>
      <UiField label="Уровень цен, 1-4">
        <UiInput v-model="form.priceLevel" />
      </UiField>
      <UiField label="Средний чек, ₽">
        <UiInput v-model="form.avgCheck" />
      </UiField>
      <fieldset>
        <legend>Часы</legend>
        <div
          v-for="day in days"
          :key="day.key"
          class="day"
        >
          <span>{{ day.label }}</span>
          <UiInput
            v-model="form.days[day.key].open"
            placeholder="09:00"
          />
          <UiInput
            v-model="form.days[day.key].close"
            placeholder="22:00"
          />
          <label>
            <input
              v-model="form.days[day.key].closed"
              type="checkbox"
            >
            выходной
          </label>
        </div>
        <UiField label="Примечание к часам">
          <UiInput v-model="form.hoursNote" />
        </UiField>
      </fieldset>
      <UiField label="Телефон">
        <UiInput v-model="form.phone" />
      </UiField>
      <UiField label="Сайт">
        <UiInput v-model="form.website" />
      </UiField>
      <UiField label="Описание, 300-600 знаков для публикации">
        <UiTextarea
          v-model="form.description"
          :rows="8"
        />
      </UiField>
      <p>{{ form.description.trim().length }} знаков</p>
      <UiField label="Источники, строка: название | url">
        <UiTextarea
          v-model="form.sources"
          :rows="4"
        />
      </UiField>
      <UiField label="Проверено, ГГГГ-ММ-ДД">
        <UiInput v-model="form.lastVerifiedAt" />
      </UiField>
      <UiField label="osmId">
        <UiInput v-model="form.osmId" />
      </UiField>
      <UiField label="SEO title">
        <UiInput v-model="form.seoTitle" />
      </UiField>
      <UiField label="SEO description">
        <UiTextarea
          v-model="form.seoDescription"
          :rows="3"
        />
      </UiField>
      <p v-if="error">
        {{ error }}
      </p>
      <UiButton type="submit">
        Сохранить
      </UiButton>
    </form>
    <form
      v-if="venueId"
      class="upload"
      @submit.prevent="upload"
    >
      <h2>Фото</h2>
      <ul>
        <li
          v-for="item in media"
          :key="item.id"
        >
          {{ item.alt || item.id }} <span v-if="item.isCover">обложка</span>
        </li>
      </ul>
      <UiField label="Файл">
        <input
          type="file"
          accept="image/*"
          @change="onFile"
        >
      </UiField>
      <UiField label="Alt">
        <UiInput v-model="uploadForm.alt" />
      </UiField>
      <UiButton type="submit">
        Загрузить
      </UiButton>
      <p v-if="uploadError">
        {{ uploadError }}
      </p>
    </form>
  </main>
</template>

<script setup lang="ts">
import type { VenueHours } from '~~/shared/venues'
import { ofetch } from 'ofetch'
import { slugError } from '~~/shared/seo'
import { VENUE_KINDS } from '~~/shared/venues'

const props = defineProps<{ venueId?: string }>()
const days = [
  { key: 'mon', label: 'пн' },
  { key: 'tue', label: 'вт' },
  { key: 'wed', label: 'ср' },
  { key: 'thu', label: 'чт' },
  { key: 'fri', label: 'пт' },
  { key: 'sat', label: 'сб' },
  { key: 'sun', label: 'вс' },
] as const

type DayKey = typeof days[number]['key']

function emptyDays() {
  return Object.fromEntries(days.map((day) => [day.key, { open: '', close: '', closed: false }])) as Record<DayKey, { open: string, close: string, closed: boolean }>
}

const meta = await ofetch<{ regions: Array<{ slug: string, title: string }> }>('/api/admin/meta')
const existing = props.venueId
  ? await ofetch<Record<string, unknown>>(`/api/admin/venues/${props.venueId}`)
  : null
const media = ref<Array<{ id: string, alt: string, isCover: boolean }>>(
  Array.isArray(existing?.media) ? existing.media as Array<{ id: string, alt: string, isCover: boolean }> : [],
)

function dayState(hours: VenueHours | null | undefined) {
  const state = emptyDays()
  if (!hours) {
    return state
  }
  for (const day of days) {
    const value = hours[day.key]
    if (Array.isArray(value) && value.length === 0) {
      state[day.key].closed = true
    } else if (Array.isArray(value) && value[0]) {
      state[day.key].open = value[0].open
      state[day.key].close = value[0].close
    }
  }
  return state
}

const form = reactive({
  name: String(existing?.name || ''),
  slug: String(existing?.slug || ''),
  kind: String(existing?.kind || 'cafe'),
  status: String(existing?.status || 'draft'),
  regionSlug: String(existing?.regionSlug || 'none'),
  cuisine: Array.isArray(existing?.cuisine) ? (existing.cuisine as string[]).join(', ') : '',
  address: String(existing?.address || ''),
  latitude: existing?.latitude == null ? '' : String(existing.latitude),
  longitude: existing?.longitude == null ? '' : String(existing.longitude),
  priceLevel: existing?.priceLevel == null ? '' : String(existing.priceLevel),
  avgCheck: existing?.avgCheck == null ? '' : String(existing.avgCheck),
  days: dayState(existing?.hours as VenueHours | undefined),
  hoursNote: String((existing?.hours as VenueHours | undefined)?.note || ''),
  phone: String(existing?.phone || ''),
  website: String(existing?.website || ''),
  description: String(existing?.description || ''),
  sources: Array.isArray(existing?.sources)
    ? (existing.sources as Array<{ title: string, url: string }>).map((item) => `${item.title} | ${item.url}`).join('\n')
    : '',
  lastVerifiedAt: existing?.lastVerifiedAt ? String(existing.lastVerifiedAt).slice(0, 10) : '',
  osmId: String(existing?.osmId || ''),
  seoTitle: String(existing?.seoTitle || ''),
  seoDescription: String(existing?.seoDescription || ''),
})
const error = ref('')
const uploadError = ref('')
const file = ref<File | null>(null)
const uploadForm = reactive({ alt: '' })
const slugProblem = computed(() => form.slug ? slugError(form.slug) : null)
const kindOptions = VENUE_KINDS.map((item) => ({ value: item.kind, label: item.label }))
const statusOptions = [
  { value: 'draft', label: 'черновик' },
  { value: 'published', label: 'опубликовано' },
  { value: 'closed', label: 'закрыто' },
  { value: 'archived', label: 'архив' },
]
const regionOptions = [{ value: 'none', label: 'не выбран' }, ...meta.regions.map((item) => ({ value: item.slug, label: item.title }))]

function numberOrNull(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function hoursPayload() {
  const hours: VenueHours = {}
  for (const day of days) {
    const row = form.days[day.key]
    if (row.closed) {
      hours[day.key] = []
    } else if (/^\d{2}:\d{2}$/.test(row.open) && /^\d{2}:\d{2}$/.test(row.close)) {
      hours[day.key] = [{ open: row.open, close: row.close }]
    }
  }
  if (form.hoursNote.trim()) {
    hours.note = form.hoursNote.trim()
  }
  return hours
}

function sourcesPayload() {
  return form.sources.split('\n').flatMap((line) => {
    const [title, url] = line.split('|').map((item) => item.trim())
    if (!title || !url) {
      return []
    }
    return [{ title, url }]
  })
}

async function save() {
  error.value = ''
  const body = {
    name: form.name,
    slug: form.slug,
    kind: form.kind,
    status: form.status,
    regionSlug: form.regionSlug === 'none' ? null : form.regionSlug,
    cuisine: form.cuisine.split(',').map((item) => item.trim()).filter(Boolean),
    address: form.address || null,
    latitude: numberOrNull(form.latitude),
    longitude: numberOrNull(form.longitude),
    priceLevel: numberOrNull(form.priceLevel),
    avgCheck: numberOrNull(form.avgCheck),
    hours: hoursPayload(),
    phone: form.phone || null,
    website: form.website || null,
    description: form.description,
    sources: sourcesPayload(),
    lastVerifiedAt: form.lastVerifiedAt.trim() || null,
    osmId: form.osmId.trim() || null,
    seoTitle: form.seoTitle || null,
    seoDescription: form.seoDescription || null,
  }
  try {
    const saved = props.venueId
      ? await ofetch(`/api/admin/venues/${props.venueId}`, { method: 'PATCH', body })
      : await ofetch('/api/admin/venues', { method: 'POST', body })
    await navigateTo(`/admin/venues/${saved.id}`)
  } catch (cause) {
    const data = cause && typeof cause === 'object' && 'data' in cause
      ? (cause as { data?: { statusMessage?: string } }).data
      : null
    error.value = data?.statusMessage || 'Не удалось сохранить'
  }
}

function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
}

async function upload() {
  uploadError.value = ''
  if (!props.venueId || !file.value) {
    uploadError.value = 'Нужен файл'
    return
  }
  const body = new FormData()
  body.set('file', file.value)
  body.set('alt', uploadForm.alt)
  body.set('venueId', props.venueId)
  body.set('license', 'own')
  body.set('author', 'K39')
  try {
    await ofetch('/api/admin/media', { method: 'POST', body })
    const fresh = await ofetch<{ media: Array<{ id: string, alt: string, isCover: boolean }> }>(`/api/admin/venues/${props.venueId}`)
    media.value = fresh.media
  } catch (cause) {
    uploadError.value = cause instanceof Error ? cause.message : 'Не удалось загрузить'
  }
}
</script>

<style scoped>
.admin { max-width: 46rem; margin: 0 auto; padding: 1.5rem; }
.stack, .upload { display: grid; gap: 0.8rem; }
.day { display: grid; grid-template-columns: 2rem 1fr 1fr auto; gap: 0.4rem; align-items: center; }
fieldset { border: 1px solid var(--color-line); padding: 0.8rem; }
</style>
