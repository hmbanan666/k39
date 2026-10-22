<template>
  <main class="admin">
    <h1>{{ venueId ? 'Заведение' : 'Новое заведение' }}</h1>
    <form @submit.prevent="save">
      <label>Название <input v-model="form.name" required></label>
      <label>Адрес страницы <input v-model="form.slug" placeholder="из названия, если пусто"></label>
      <label>Тип
        <select v-model="form.kind">
          <option
            v-for="kind in kinds"
            :key="kind"
            :value="kind"
          >
            {{ kind }}
          </option>
        </select>
      </label>
      <label>Регион
        <select v-model="form.regionSlug">
          <option value="">
            не выбран
          </option>
          <option
            v-for="region in regions"
            :key="region.id"
            :value="region.slug"
          >
            {{ region.title }}
          </option>
        </select>
      </label>
      <label>Статус
        <select v-model="form.status">
          <option value="draft">черновик</option>
          <option value="published">опубликовано</option>
          <option value="closed">закрыто</option>
          <option value="archived">в архиве</option>
        </select>
      </label>
      <label>Кухня <input v-model="form.cuisine" placeholder="кофе, пицца"></label>
      <label>Адрес <input v-model="form.address"></label>
      <label>Широта <input v-model="form.latitude" inputmode="decimal"></label>
      <label>Долгота <input v-model="form.longitude" inputmode="decimal"></label>
      <label>Уровень цен
        <select v-model="form.priceLevel">
          <option value="">нет</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
        </select>
      </label>
      <label>Средний чек, ₽ <input v-model="form.avgCheck" inputmode="numeric"></label>
      <label>Телефон <input v-model="form.phone"></label>
      <label>Сайт <input v-model="form.website"></label>
      <div class="field">
        <label>ID сообщества ВКонтакте
          <input
            v-model="form.vkCommunityId"
            inputmode="numeric"
            :placeholder="vkField.disabled ? '' : '236300695'"
            :disabled="vkField.disabled && !form.vkCommunityId"
            :aria-invalid="vkField.error ? 'true' : undefined"
            aria-describedby="vk-community-hint"
          >
        </label>
        <p
          id="vk-community-hint"
          class="hint"
        >
          <template v-if="vkField.disabled">
            В «Соцсети» нет ссылки ВКонтакте. ID задаётся вместе с ней.
          </template>
          <template v-else>
            Нужен, когда в «Соцсети» ссылка по имени<template v-if="vkField.screenNames.length">
              ({{ vkField.screenNames.map((name) => `vk.com/${name}`).join(', ') }})
            </template>,
            а меню лежит в альбоме, фото, записи или товарах. Число берите из адреса:
            vk.com/album-236300695_311487837 даёт 236300695.
            <template v-if="vkField.impliedIds.length">
              Ссылки в «Соцсети» уже дают ID {{ vkField.impliedIds.join(', ') }}.
            </template>
          </template>
        </p>
        <p
          v-if="vkField.error"
          class="error"
        >
          {{ vkField.error }}
        </p>
      </div>
      <label>Проверено <input v-model="form.lastVerifiedAt" placeholder="2026-10-13"></label>
      <fieldset>
        <legend>Часы</legend>
        <VenueHoursTable
          v-model:days="form.days"
          :editable="hours.editable"
          :table="hours.table"
          :lines="hours.lines"
        />
        <p
          v-if="hours.editable"
          class="hint"
        >
          Источник называет только время открытия? Оставьте закрытие пустым: на сайте будет «с 12:00, закрытие уточняйте».
          Источник молчит про день? Выберите «часы уточняйте»: на сайте день не станет выходным.
        </p>
        <label>Заметка <input
          v-model="form.hoursNote"
          :disabled="!hours.editable"
        ></label>
      </fieldset>
      <label>Описание
        <textarea
          v-model="form.description"
          rows="8"
        />
      </label>
      <p class="hint">
        {{ form.description.trim().length }} знаков. Для публикации нужно 300-600.
      </p>
      <label>Источники, по строке «название | url»
        <textarea
          v-model="form.sources"
          rows="3"
        />
      </label>
      <p
        v-if="error"
        class="error"
      >
        {{ error }}
      </p>
      <button type="submit">
        Сохранить
      </button>
    </form>
    <form
      v-if="venueId"
      class="photo"
      @submit.prevent="upload"
    >
      <h2>Фото</h2>
      <input
        type="file"
        accept="image/*"
        required
        @change="onFile"
      >
      <label>Подпись <input v-model="photo.alt" required></label>
      <label>Автор <input v-model="photo.author"></label>
      <label>Лицензия
        <select v-model="photo.license">
          <option value="own">своя</option>
          <option value="cc-by">cc-by</option>
          <option value="cc-by-sa">cc-by-sa</option>
          <option value="cc0">cc0</option>
          <option value="pd">pd</option>
          <option value="permission">разрешение</option>
        </select>
      </label>
      <label>Источник фото <input v-model="photo.sourceUrl"></label>
      <button type="submit">
        Загрузить
      </button>
    </form>
    <section
      v-if="venueId"
      class="history"
    >
      <h2>Журнал</h2>
      <p
        v-if="historyError"
        class="error"
      >
        {{ historyError }}
      </p>
      <ul>
        <li
          v-for="row in revisions"
          :key="row.id"
        >
          <span>{{ row.createdAt }} · {{ row.summary.name }} · {{ row.actorEmail || 'без автора' }}</span>
          <button
            type="button"
            @click="revert(row.id)"
          >
            Вернуть эту версию
          </button>
        </li>
      </ul>
      <h3>События</h3>
      <ul>
        <li
          v-for="row in audits"
          :key="row.id"
        >
          {{ row.createdAt }} · {{ row.action }} · {{ row.actorEmail || 'система' }}
        </li>
      </ul>
    </section>
  </main>
</template>

<script setup lang="ts">
import type { HoursFormState } from '~~/shared/venue-hours-form'
import { hoursFormState, hoursPayload } from '~~/shared/venue-hours-form'
import { vkCommunityField } from '~~/shared/venue-vk-form'

const props = defineProps<{ venueId?: string }>()
const requestFetch = useRequestFetch()
const kinds = ['cafe', 'restaurant', 'coffee', 'bar', 'bakery', 'market', 'fastfood', 'other']
const regions = ref<Array<{ id: string, slug: string, title: string }>>([])
const error = ref('')
const historyError = ref('')
const revisions = ref<Array<{ id: string, createdAt: string, actorEmail: string | null, summary: { name: string } }>>([])
const audits = ref<Array<{ id: string, createdAt: string, action: string, actorEmail: string | null }>>([])
const file = ref<File | null>(null)
const photo = reactive({ alt: '', author: '', license: 'own', sourceUrl: '' })

const form = reactive({
  name: '',
  slug: '',
  kind: 'cafe',
  regionSlug: '',
  status: 'draft',
  cuisine: '',
  address: '',
  latitude: '',
  longitude: '',
  priceLevel: '',
  avgCheck: '',
  phone: '',
  website: '',
  vkCommunityId: '',
  lastVerifiedAt: '',
  hoursNote: '',
  description: '',
  sources: '',
  days: hoursFormState(null, '').days,
})
const hours = ref<HoursFormState>(hoursFormState(null, ''))
// The hours as loaded. A save sends `hours` only when the table or the note differs.
const savedHours = ref('')

const socials = ref<Array<{ network: string, url: string }>>([])
const vkField = computed(() => vkCommunityField(form.vkCommunityId, socials.value))

const meta = await requestFetch<{ regions: Array<{ id: string, slug: string, title: string }> }>('/api/admin/meta')
regions.value = meta.regions

if (props.venueId) {
  const loaded = await requestFetch<{
    venue: {
      name: string
      slug: string
      kind: string
      regionId: string | null
      status: string
      cuisineTags: string[]
      address: string | null
      latitude: number | null
      longitude: number | null
      priceLevel: number | null
      avgCheck: number | null
      phone: string | null
      website: string | null
      socials: Array<{ network: string, url: string }>
      vkCommunityId: number | null
      lastVerifiedAt: string | null
      description: string
      sources: Array<{ title: string, url: string }>
    }
    hours: HoursFormState
  }>(`/api/admin/venues/${props.venueId}`)
  const venue = loaded.venue
  form.name = venue.name
  form.slug = venue.slug
  form.kind = venue.kind
  form.regionSlug = regions.value.find((item) => item.id === venue.regionId)?.slug || ''
  form.status = venue.status
  form.cuisine = venue.cuisineTags.join(', ')
  form.address = venue.address || ''
  form.latitude = venue.latitude == null ? '' : String(venue.latitude)
  form.longitude = venue.longitude == null ? '' : String(venue.longitude)
  form.priceLevel = venue.priceLevel == null ? '' : String(venue.priceLevel)
  form.avgCheck = venue.avgCheck == null ? '' : String(venue.avgCheck)
  form.phone = venue.phone || ''
  form.website = venue.website || ''
  socials.value = venue.socials || []
  form.vkCommunityId = venue.vkCommunityId == null ? '' : String(venue.vkCommunityId)
  form.lastVerifiedAt = venue.lastVerifiedAt ? venue.lastVerifiedAt.slice(0, 10) : ''
  form.description = venue.description
  form.sources = (venue.sources || []).map((item) => `${item.title} | ${item.url}`).join('\n')
  hours.value = loaded.hours
  form.days = loaded.hours.days
  form.hoursNote = loaded.hours.note
}
savedHours.value = JSON.stringify(hoursField())

function hoursField() {
  return hoursPayload(form.days, form.hoursNote, { openEnded: true })
}

/** The weekly table, only when it is editable and differs from what was loaded or saved. */
function changedHours() {
  const next = hoursField()
  return hours.value.editable && JSON.stringify(next) !== savedHours.value ? next : undefined
}

function numberOrNull(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  return Number(trimmed.replace(',', '.'))
}

function payload() {
  return {
    name: form.name,
    slug: form.slug || undefined,
    kind: form.kind,
    regionSlug: form.regionSlug || null,
    status: form.status,
    cuisineTags: form.cuisine.split(',').map((item) => item.trim()).filter(Boolean),
    address: form.address || null,
    latitude: numberOrNull(form.latitude),
    longitude: numberOrNull(form.longitude),
    priceLevel: form.priceLevel ? Number(form.priceLevel) : null,
    avgCheck: form.avgCheck ? Number(form.avgCheck) : null,
    phone: form.phone || null,
    website: form.website || null,
    vkCommunityId: vkField.value.value ?? null,
    lastVerifiedAt: form.lastVerifiedAt || null,
    description: form.description,
    sources: form.sources.split('\n').flatMap((line) => {
      const [title, url] = line.split('|').map((item) => item.trim())
      return title && url ? [{ title, url }] : []
    }),
    hours: changedHours(),
  }
}

async function save() {
  error.value = ''
  if (vkField.value.error) {
    error.value = 'Проверьте поле «ID сообщества ВКонтакте»'
    return
  }
  try {
    if (props.venueId) {
      await requestFetch(`/api/admin/venues/${props.venueId}`, { method: 'PATCH', body: payload() })
      savedHours.value = JSON.stringify(hoursField())
      return
    }
    const created = await requestFetch<{ id: string }>('/api/admin/venues', { method: 'POST', body: payload() })
    await navigateTo(`/admin/venues/${created.id}`)
  } catch (reason) {
    error.value = (reason as { data?: { message?: string }, statusMessage?: string }).data?.message
      || (reason as { statusMessage?: string }).statusMessage
      || 'Не удалось сохранить'
  }
}

function onFile(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

async function loadHistory() {
  if (!props.venueId) {
    return
  }
  const history = await requestFetch<{
    revisions: typeof revisions.value
    audits: typeof audits.value
  }>(`/api/admin/venues/${props.venueId}/revisions`)
  revisions.value = history.revisions
  audits.value = history.audits
}

if (props.venueId) {
  await loadHistory().catch(() => {
    historyError.value = 'Журнал не загрузился'
  })
}

async function revert(revisionId: string) {
  historyError.value = ''
  try {
    await requestFetch(`/api/admin/venues/${props.venueId}/revert`, { method: 'POST', body: { revisionId } })
    window.location.reload()
  } catch (reason) {
    historyError.value = (reason as { data?: { message?: string, statusMessage?: string } }).data?.statusMessage
      || (reason as { data?: { message?: string } }).data?.message
      || 'Не удалось вернуть версию'
  }
}

async function upload() {
  if (!props.venueId || !file.value) {
    return
  }
  error.value = ''
  const body = new FormData()
  body.set('file', file.value)
  body.set('alt', photo.alt)
  body.set('author', photo.author)
  body.set('license', photo.license)
  body.set('sourceUrl', photo.sourceUrl)
  body.set('isCover', 'true')
  try {
    await requestFetch(`/api/admin/venues/${props.venueId}/media`, { method: 'POST', body })
  } catch (reason) {
    error.value = (reason as { data?: { message?: string } }).data?.message || 'Не удалось загрузить фото'
  }
}
</script>

<style scoped>
.admin { max-width: 46rem; margin: 0 auto; padding: 1.5rem; }
form { display: grid; gap: 0.7rem; }
label { display: grid; gap: 0.25rem; }
input, select, textarea { font: inherit; padding: 0.4rem 0.5rem; min-width: 0; }
.hint { overflow-wrap: anywhere; }
.hint, .error { margin: 0; }
.field { display: grid; gap: 0.25rem; }
input[aria-invalid='true'] { outline: 2px solid var(--color-danger); }
.error { color: var(--color-danger); }
.photo, .history { margin-top: 2rem; }
.history li { display: flex; flex-wrap: wrap; gap: 0.4rem 0.8rem; justify-content: space-between; padding: 0.4rem 0; }
</style>
