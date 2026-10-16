<template>
  <main class="admin">
    <h1>{{ placeId ? 'Место' : 'Новое место' }}</h1>
    <form
      class="stack"
      @submit.prevent="save"
    >
      <AdminPlaceDraftNotice
        v-if="pending"
        :pending="pending"
        :busy="busy"
        @apply="onApply"
        @discard="onDiscard"
      />
      <UiField label="Название">
        <UiInput
          v-model="form.title"
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
      <UiField label="Раздел">
        <UiSelect
          v-model="form.categorySlug"
          :options="categoryOptions"
        />
      </UiField>
      <UiField label="Статус объекта">
        <UiSelect
          v-model="form.status"
          :options="statusOptions"
        />
      </UiField>
      <UiField label="Публикация">
        <UiSelect
          v-model="form.publicationStatus"
          :options="publicationOptions"
        />
      </UiField>
      <UiField label="Кратко">
        <UiTextarea
          v-model="form.summary"
          :rows="3"
        />
      </UiField>
      <UiField label="Текст">
        <UiTextarea
          v-model="form.body"
          :rows="12"
        />
      </UiField>
      <div class="preview">
        <h2>Предпросмотр</h2>
        <ProseHtml :html="preview" />
      </div>
      <UiField label="Часы">
        <UiInput v-model="form.hours" />
      </UiField>
      <UiField label="Цена">
        <UiInput v-model="form.price" />
      </UiField>
      <UiField label="Адрес">
        <UiTextarea
          v-model="form.howToGet"
          :rows="3"
        />
      </UiField>
      <UiField label="Широта">
        <UiInput v-model="form.latitude" />
      </UiField>
      <UiField label="Долгота">
        <UiInput v-model="form.longitude" />
      </UiField>
      <p
        v-if="!form.latitude || !form.longitude"
        class="warn"
      >
        Нет координат.
      </p>
      <UiField
        label="SEO title"
        :count="finalTitle.length"
        :max="70"
        :hint="titleHint"
      >
        <UiInput v-model="form.seoTitle" />
      </UiField>
      <p>Заголовок в поиске: {{ finalTitle }}</p>
      <UiField
        label="SEO description"
        :count="finalDescription.length"
        :max="170"
        :hint="descriptionHint"
      >
        <UiTextarea
          v-model="form.seoDescription"
          :rows="3"
        />
      </UiField>
      <UiField label="Картинка для соцсетей">
        <UiInput
          v-model="form.ogImage"
          placeholder="/media/..."
        />
      </UiField>
      <UiSwitch
        v-model="form.noindex"
        label="Не индексировать"
      />
      <p v-if="placeId">
        <a :href="`/preview/${form.slug}`">Предпросмотр черновика</a>
      </p>
      <div class="serp">
        <strong>{{ finalTitle }}</strong>
        <div>k39.online/{{ form.slug }}</div>
        <p>{{ finalDescription }}</p>
      </div>
      <section v-if="placeId">
        <h2>Фотографии</h2>
        <p>
          <a :href="`/admin/media?place=${placeId}`">Открыть загрузку</a>
        </p>
        <ul class="shots">
          <li
            v-for="item in shots"
            :key="item.media.id"
          >
            {{ item.media.alt }}<template v-if="item.isCover">
              · обложка
            </template>
          </li>
        </ul>
      </section>
      <div
        v-if="choice"
        id="place-draft-choice"
        class="choice"
      >
        <h2>{{ choice === 'apply' ? 'Применить черновик?' : 'Что оставить?' }}</h2>
        <p>{{ choiceText }}</p>
        <div class="choice-actions">
          <UiButton
            v-if="choice === 'save'"
            type="button"
            variant="sea"
            :disabled="busy"
            @click="saveAndDiscard"
          >
            Сохранить форму и отбросить черновик
          </UiButton>
          <UiButton
            type="button"
            :disabled="busy"
            @click="confirmApply"
          >
            Применить черновик
          </UiButton>
          <UiButton
            type="button"
            variant="quiet"
            :disabled="busy"
            @click="choice = null"
          >
            Вернуться к форме
          </UiButton>
        </div>
      </div>
      <UiButton
        type="submit"
        :disabled="busy"
      >
        Сохранить
      </UiButton>
      <p
        v-if="message"
        aria-live="polite"
      >
        {{ message }}
      </p>
    </form>
    <MetaFootnote />
  </main>
</template>

<script setup lang="ts">
import type { FetchError } from 'ofetch'
import type { PlaceDraftNotice } from '~~/shared/place-draft-diff'
import { renderMarkdown } from '~~/shared/markdown'
import { descriptionWarning, metaDescription, pageTitle, slugError, titleWarning, transliterateSlug } from '~~/shared/seo'

interface AdminCategory { id: string, slug: string, title: string }
interface AdminPlace {
  id: string
  categoryId: string | null
  title: string
  slug: string
  status: string
  publicationStatus: string
  summary: string
  body: string
  hours: string | null
  price: string | null
  howToGet: string | null
  latitude: number | null
  longitude: number | null
  seoTitle: string | null
  seoDescription: string | null
  ogImage: string | null
  noindex: boolean
}

const props = defineProps<{ placeId?: string }>()
const requestFetch = useRequestFetch()
const shots = ref<Array<{ media: { id: string, alt: string }, isCover: boolean }>>([])
if (props.placeId) {
  shots.value = await requestFetch(`/api/admin/media?placeId=${props.placeId}`)
}
const meta = await requestFetch<{ categories: AdminCategory[] }>('/api/admin/meta')
const form = reactive({
  title: '',
  slug: '',
  categorySlug: 'forty',
  status: 'unknown',
  publicationStatus: 'draft',
  summary: '',
  body: '',
  hours: '',
  price: '',
  howToGet: '',
  latitude: '' as string | number,
  longitude: '' as string | number,
  seoTitle: '',
  seoDescription: '',
  ogImage: '',
  noindex: false,
})
const pending = ref<PlaceDraftNotice | null>(null)
const baseline = ref('')
const choice = ref<'save' | 'apply' | null>(null)
const busy = ref(false)
const message = ref('')

function fill(current: AdminPlace | undefined) {
  const categorySlug = meta.categories.find((item) => item.id === current?.categoryId)?.slug || 'forty'
  form.title = current?.title || ''
  form.slug = current?.slug || ''
  form.categorySlug = categorySlug
  form.status = current?.status || 'unknown'
  form.publicationStatus = current?.publicationStatus || 'draft'
  form.summary = current?.summary || ''
  form.body = current?.body || ''
  form.hours = current?.hours || ''
  form.price = current?.price || ''
  form.howToGet = current?.howToGet || ''
  form.latitude = current?.latitude ?? ''
  form.longitude = current?.longitude ?? ''
  form.seoTitle = current?.seoTitle || ''
  form.seoDescription = current?.seoDescription || ''
  form.ogImage = current?.ogImage || ''
  form.noindex = current?.noindex || false
  baseline.value = JSON.stringify(form)
}

async function loadPlace() {
  if (!props.placeId) {
    fill(undefined)
    pending.value = null
    return
  }
  const places = await requestFetch<AdminPlace[]>('/api/admin/places')
  const current = places.find((item) => item.id === props.placeId)
  fill(current)
  pending.value = current
    ? (await requestFetch<{ pending: PlaceDraftNotice | null }>(`/api/admin/places/${props.placeId}/draft`)).pending
    : null
}

await loadPlace()
watch(() => form.title, (title) => {
  if (!props.placeId && title && !form.slug) {
    form.slug = transliterateSlug(title)
  }
})
const categoryOptions = computed(() => meta.categories.map((item) => ({ value: item.slug, label: item.title })))
const statusOptions = [
  { value: 'open', label: 'открыт' },
  { value: 'ruins', label: 'руины' },
  { value: 'closed', label: 'закрыт' },
  { value: 'unknown', label: 'неизвестно' },
]
const publicationOptions = [
  { value: 'draft', label: 'черновик' },
  { value: 'review', label: 'на проверке' },
  { value: 'published', label: 'опубликовано' },
]
const slugProblem = computed(() => form.slug ? slugError(form.slug) : null)
const finalTitle = computed(() => pageTitle(form.title || 'Без названия', form.seoTitle))
const finalDescription = computed(() => metaDescription(form.summary, form.seoDescription))
const titleHint = computed(() => titleWarning(finalTitle.value))
const descriptionHint = computed(() => descriptionWarning(finalDescription.value))
const preview = computed(() => renderMarkdown(form.body))
const dirty = computed(() => JSON.stringify(form) !== baseline.value)
const choiceText = computed(() => {
  if (choice.value === 'apply') {
    return 'В форме есть правки. Они не сохранятся. На сайт попадёт черновик.'
  }
  if (dirty.value) {
    return 'Сохранение запишет правки формы и удалит черновик. Применение запишет черновик и не сохранит правки формы.'
  }
  return 'Сохранение оставит живую страницу и удалит черновик. Применение запишет черновик на сайт.'
})

function failure(error: unknown, fallback: string) {
  const data = (error as FetchError<{ statusMessage?: string }>)?.data
  return data?.statusMessage || fallback
}

function payload(discard: boolean) {
  return {
    ...form,
    latitude: form.latitude === '' ? null : Number(form.latitude),
    longitude: form.longitude === '' ? null : Number(form.longitude),
    ...(discard ? { pendingDraft: 'discard' } : {}),
  }
}

async function save() {
  if (slugProblem.value || busy.value) {
    return
  }
  if (props.placeId && pending.value) {
    choice.value = 'save'
    await nextTick()
    document.getElementById('place-draft-choice')?.scrollIntoView({ block: 'nearest' })
    return
  }
  await persist(false)
}

async function saveAndDiscard() {
  await persist(true)
}

async function persist(discard: boolean) {
  if (slugProblem.value || busy.value) {
    return
  }
  busy.value = true
  message.value = ''
  try {
    if (props.placeId) {
      await requestFetch(`/api/admin/places/${props.placeId}`, { method: 'PATCH', body: payload(discard) })
      choice.value = null
      if (discard) {
        pending.value = null
      }
      baseline.value = JSON.stringify(form)
      message.value = discard ? 'Сохранено, черновик отброшен' : 'Сохранено'
      return
    }
    const created = await requestFetch('/api/admin/places', { method: 'POST', body: payload(false) })
    await navigateTo(`/admin/places/${created.id}`)
  } catch (error) {
    message.value = failure(error, 'Не сохранилось')
  } finally {
    busy.value = false
  }
}

function onApply() {
  if (dirty.value) {
    choice.value = 'apply'
    nextTick(() => document.getElementById('place-draft-choice')?.scrollIntoView({ block: 'nearest' }))
    return
  }
  void confirmApply()
}

async function confirmApply() {
  if (!props.placeId || busy.value) {
    return
  }
  busy.value = true
  message.value = ''
  try {
    await requestFetch(`/api/admin/places/${props.placeId}/draft`, { method: 'POST', body: { action: 'apply' } })
    choice.value = null
    await loadPlace()
    message.value = 'Черновик опубликован'
  } catch (error) {
    message.value = failure(error, 'Черновик не опубликован')
  } finally {
    busy.value = false
  }
}

async function onDiscard() {
  if (!props.placeId || busy.value) {
    return
  }
  busy.value = true
  message.value = ''
  try {
    await requestFetch(`/api/admin/places/${props.placeId}/draft`, { method: 'POST', body: { action: 'discard' } })
    pending.value = null
    choice.value = null
    message.value = 'Черновик отброшен'
  } catch (error) {
    message.value = failure(error, 'Черновик не отброшен')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.admin { max-width: 46rem; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
form { display: flex; flex-direction: column; gap: 0.7rem; }
label { display: flex; flex-direction: column; gap: 0.25rem; }
input, textarea, select { font: inherit; padding: 0.4rem 0.5rem; }
.warn { color: #9b3d2a; }
.serp { border: 1px solid #e6d5b0; padding: 0.8rem; }
.preview { border-top: 1px solid #e6d5b0; padding-top: 0.6rem; }
.choice {
  padding: var(--space-4);
  border: 1px solid var(--color-line);
  border-left: 4px solid var(--color-brick);
  border-radius: var(--radius-md);
  background: var(--surface);
}
.choice h2 {
  margin: 0 0 var(--space-2);
  font-family: var(--font-display);
  font-size: var(--step-1);
  font-weight: 700;
}
.choice p { margin: 0 0 var(--space-3); max-width: 62ch; }
.choice-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.choice-actions :deep(.btn) {
  flex: 1 1 14rem;
  height: auto;
  min-height: 2.6rem;
  white-space: normal;
  text-align: center;
}
</style>
