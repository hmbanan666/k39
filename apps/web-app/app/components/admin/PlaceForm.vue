<template>
  <main class="admin">
    <h1>{{ placeId ? 'Место' : 'Новое место' }}</h1>
    <form
      class="stack"
      @submit.prevent="save"
    >
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
        <div v-html="preview" />
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
      <UiButton type="submit">
        Сохранить
      </UiButton>
      <p v-if="message">
        {{ message }}
      </p>
    </form>
  </main>
</template>

<script setup lang="ts">
import { ofetch } from 'ofetch'
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
const shots = ref<Array<{ media: { id: string, alt: string }, isCover: boolean }>>([])
if (props.placeId) {
  shots.value = await ofetch(`/api/admin/media?placeId=${props.placeId}`)
}
const meta = await ofetch<{ categories: AdminCategory[] }>('/api/admin/meta')
const places = props.placeId ? await ofetch<AdminPlace[]>('/api/admin/places') : []
const current = places.find((item) => item.id === props.placeId)
const categorySlug = meta.categories.find((item) => item.id === current?.categoryId)?.slug || 'forty'
const form = reactive({
  title: current?.title || '',
  slug: current?.slug || '',
  categorySlug,
  status: current?.status || 'unknown',
  publicationStatus: current?.publicationStatus || 'draft',
  summary: current?.summary || '',
  body: current?.body || '',
  hours: current?.hours || '',
  price: current?.price || '',
  howToGet: current?.howToGet || '',
  latitude: current?.latitude ?? '',
  longitude: current?.longitude ?? '',
  seoTitle: current?.seoTitle || '',
  seoDescription: current?.seoDescription || '',
  ogImage: current?.ogImage || '',
  noindex: current?.noindex || false,
})
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
const categoryTitle = computed(() => meta.categories.find((item) => item.slug === form.categorySlug)?.title || 'место')
const finalTitle = computed(() => pageTitle(form.title || 'Без названия', categoryTitle.value, form.seoTitle))
const finalDescription = computed(() => metaDescription(form.summary, form.seoDescription))
const titleHint = computed(() => titleWarning(finalTitle.value))
const descriptionHint = computed(() => descriptionWarning(finalDescription.value))
const preview = computed(() => renderMarkdown(form.body))
const message = ref('')

async function save() {
  if (slugProblem.value) {
    return
  }
  const payload = {
    ...form,
    latitude: form.latitude === '' ? null : Number(form.latitude),
    longitude: form.longitude === '' ? null : Number(form.longitude),
  }
  if (props.placeId) {
    await ofetch(`/api/admin/places/${props.placeId}`, { method: 'PATCH', body: payload })
    message.value = 'Сохранено'
    return
  }
  const created = await ofetch('/api/admin/places', { method: 'POST', body: payload })
  await navigateTo(`/admin/places/${created.id}`)
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
</style>
