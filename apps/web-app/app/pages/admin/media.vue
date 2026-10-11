<template>
  <main class="admin">
    <h1>Медиа</h1>
    <label>
      Место
      <select v-model="placeId">
        <option value="">Все фото</option>
        <option
          v-for="place in places"
          :key="place.id"
          :value="place.id"
        >
          {{ place.title }}
        </option>
      </select>
    </label>
    <form
      class="upload"
      @submit.prevent="uploadAll"
    >
      <div
        class="drop"
        @dragover.prevent
        @drop.prevent="onDrop"
      >
        Перетащите JPEG, PNG или WebP
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          @change="onFile"
        >
      </div>
      <label>Alt <input
        v-model="alt"
        required
      ></label>
      <p
        v-if="!alt.trim()"
        class="warn"
      >
        Alt обязателен.
      </p>
      <label>Автор <input v-model="author"></label>
      <label>
        Лицензия
        <select v-model="license">
          <option
            v-for="item in licenses"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </option>
        </select>
      </label>
      <label>Источник <input v-model="sourceUrl"></label>
      <label>Подпись <input v-model="caption"></label>
      <p v-if="queue.length">
        Файлов: {{ queue.length }}
      </p>
      <button
        type="submit"
        :disabled="!alt.trim() || !queue.length || busy"
      >
        Загрузить
      </button>
      <p
        v-for="(note, index) in notes"
        :key="index"
        :class="{ warn: note.warn }"
      >
        {{ note.text }}
      </p>
    </form>
    <p v-if="placeId">
      <button
        type="button"
        @click="findCommons"
      >
        Найти фото на Викискладе
      </button>
    </p>
    <ul
      v-if="commons.length"
      class="commons"
    >
      <li
        v-for="hit in commons"
        :key="hit.pageUrl"
      >
        <img
          :src="hit.thumbUrl"
          :alt="hit.title"
          width="160"
          height="120"
        >
        <p>{{ hit.author || 'автор не указан' }} · {{ hit.licenseName }}</p>
        <button
          type="button"
          @click="importHit(hit)"
        >
          Импортировать
        </button>
      </li>
    </ul>
    <ul class="gallery">
      <li
        v-for="(item, index) in gallery"
        :key="item.media.id"
        draggable="true"
        @dragstart="dragIndex = index"
        @dragover.prevent
        @drop="dropOn(index)"
      >
        <img
          :src="preview(item.media)"
          :alt="item.media.alt"
          :style="focalStyle(item.media)"
          width="240"
          height="160"
          @click="setFocal($event, item.media)"
        >
        <p>
          {{ item.media.alt }}
          <template v-if="item.isCover">
            · обложка
          </template>
        </p>
        <p
          v-if="item.media.width && item.media.width < 1200"
          class="warn"
        >
          Уже 1200 px
        </p>
        <button
          type="button"
          @click="makeCover(item.media.id)"
        >
          Сделать обложкой
        </button>
        <button
          type="button"
          @click="remove(item.media.id)"
        >
          Удалить
        </button>
      </li>
    </ul>
  </main>
</template>

<script setup lang="ts">
import { ofetch } from 'ofetch'

interface PlaceRow { id: string, title: string }
interface MediaRow {
  id: string
  alt: string
  filename: string
  width: number | null
  focalX: number
  focalY: number
  variants: Array<{ file: string }> | null
}
interface GalleryItem { media: MediaRow, isCover: boolean, sortOrder: number }
interface CommonsHit {
  title: string
  pageUrl: string
  thumbUrl: string
  fileUrl: string
  author: string
  license: string
  licenseName: string
}

definePageMeta({ layout: 'admin', middleware: ['admin-only'] })
const route = useRoute()
const places = ref<PlaceRow[]>([])
const placeId = ref(String(route.query.place || ''))
const alt = ref('')
const author = ref('')
const license = ref('own')
const sourceUrl = ref('')
const caption = ref('')
const queue = ref<File[]>([])
const notes = ref<Array<{ text: string, warn: boolean }>>([])
const busy = ref(false)
const gallery = ref<GalleryItem[]>([])
const commons = ref<CommonsHit[]>([])
const dragIndex = ref(-1)
const licenses = [
  { value: 'own', label: 'Своё фото' },
  { value: 'cc-by', label: 'CC BY' },
  { value: 'cc-by-sa', label: 'CC BY-SA' },
  { value: 'cc0', label: 'CC0' },
  { value: 'pd', label: 'Общественное достояние' },
  { value: 'permission', label: 'С разрешения автора' },
]

onMounted(async () => {
  places.value = await ofetch<PlaceRow[]>('/api/admin/places')
  await loadGallery()
})
watch(placeId, loadGallery)

function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  queue.value = [...(input.files ?? [])]
}
function onDrop(event: DragEvent) {
  queue.value = [...(event.dataTransfer?.files ?? [])]
}
function preview(row: MediaRow) {
  if (row.variants?.some((item) => item.file === '320.webp')) {
    return `/media/${row.id}/320.webp`
  }
  return `/media/${row.filename}`
}
function focalStyle(row: MediaRow) {
  return { objectPosition: `${(row.focalX ?? 0.5) * 100}% ${(row.focalY ?? 0.5) * 100}%` }
}
async function loadGallery() {
  if (!placeId.value) {
    const rows = await ofetch<MediaRow[]>('/api/admin/media')
    gallery.value = rows.map((media) => ({ media, isCover: false, sortOrder: 0 }))
    return
  }
  gallery.value = await ofetch<GalleryItem[]>(`/api/admin/media?placeId=${placeId.value}`)
}
function uploadOne(file: File) {
  return new Promise<{ warning?: string }>((resolve, reject) => {
    const body = new FormData()
    body.set('file', file)
    body.set('alt', alt.value.trim())
    body.set('author', author.value)
    body.set('license', license.value)
    body.set('sourceUrl', sourceUrl.value)
    body.set('caption', caption.value)
    if (placeId.value) {
      body.set('placeId', placeId.value)
    }
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/admin/media')
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText))
        return
      }
      reject(new Error(xhr.responseText || 'Ошибка загрузки'))
    }
    xhr.onerror = () => reject(new Error('Ошибка загрузки'))
    xhr.send(body)
  })
}
async function uploadAll() {
  busy.value = true
  notes.value = []
  for (const file of queue.value) {
    try {
      const row = await uploadOne(file)
      notes.value.push({ text: row.warning || `${file.name} сохранён`, warn: Boolean(row.warning) })
    } catch (error) {
      notes.value.push({ text: error instanceof Error ? error.message : 'Ошибка загрузки', warn: true })
    }
  }
  queue.value = []
  busy.value = false
  await loadGallery()
}
async function makeCover(id: string) {
  if (!placeId.value) {
    return
  }
  await ofetch(`/api/admin/media/${id}`, { method: 'PATCH', body: { placeId: placeId.value, isCover: true } })
  await loadGallery()
}
async function remove(id: string) {
  await ofetch(`/api/admin/media/${id}`, { method: 'DELETE' })
  await loadGallery()
}
async function setFocal(event: MouseEvent, row: MediaRow) {
  const target = event.currentTarget as HTMLImageElement
  const rect = target.getBoundingClientRect()
  const focalX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  const focalY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
  await ofetch(`/api/admin/media/${row.id}`, { method: 'PATCH', body: { focalX, focalY } })
  await loadGallery()
}
async function dropOn(index: number) {
  if (!placeId.value || dragIndex.value < 0 || dragIndex.value === index) {
    return
  }
  const next = gallery.value.slice()
  const [moved] = next.splice(dragIndex.value, 1)
  if (!moved) {
    return
  }
  next.splice(index, 0, moved)
  gallery.value = next
  dragIndex.value = -1
  await ofetch(`/api/admin/media/${moved.media.id}`, {
    method: 'PATCH',
    body: { placeId: placeId.value, order: next.map((item) => item.media.id) },
  })
}
async function findCommons() {
  commons.value = (await ofetch<{ hits: CommonsHit[] }>(`/api/admin/commons?placeId=${placeId.value}`)).hits
}
async function importHit(hit: CommonsHit) {
  await ofetch('/api/admin/commons/import', {
    method: 'POST',
    body: {
      fileUrl: hit.fileUrl,
      pageUrl: hit.pageUrl,
      alt: alt.value.trim() || hit.title,
      author: hit.author,
      license: hit.license,
      placeId: placeId.value,
    },
  })
  await loadGallery()
}
</script>

<style scoped>
.admin { max-width: 52rem; margin: 0 auto; padding: 1.5rem; }
.upload, .admin { display: flex; flex-direction: column; gap: 0.7rem; }
.drop { padding: 1rem; border: 1px dashed var(--color-line); border-radius: 12px; background: var(--color-surface); }
.gallery, .commons { display: grid; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); gap: 0.8rem; padding: 0; list-style: none; }
.gallery li, .commons li { padding: 0.5rem; border: 1px solid var(--color-line); border-radius: 12px; background: var(--color-surface); }
img { display: block; width: 100%; height: 8rem; object-fit: cover; cursor: crosshair; }
.warn { color: var(--color-danger); }
button, select, input { font: inherit; }
</style>
