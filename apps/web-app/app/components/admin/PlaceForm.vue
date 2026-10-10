<template>
  <main class="admin">
    <h1>{{ placeId ? 'Место' : 'Новое место' }}</h1>
    <form @submit.prevent="save">
      <label>Название <input v-model="form.title" required></label>
      <label>Адрес (slug) <input v-model="form.slug" required></label>
      <p
        v-if="slugProblem"
        class="warn"
      >
        {{ slugProblem }}
      </p>
      <label>Раздел
        <select v-model="form.categorySlug">
          <option
            v-for="category in meta.categories"
            :key="category.id"
            :value="category.slug"
          >
            {{ category.title }}
          </option>
        </select>
      </label>
      <label>Статус объекта
        <select v-model="form.status">
          <option value="open">открыт</option>
          <option value="ruins">руины</option>
          <option value="closed">закрыт</option>
          <option value="unknown">неизвестно</option>
        </select>
      </label>
      <label>Публикация
        <select v-model="form.publicationStatus">
          <option value="draft">черновик</option>
          <option value="review">на проверке</option>
          <option value="published">опубликовано</option>
        </select>
      </label>
      <label>Кратко <textarea v-model="form.summary" rows="3" /></label>
      <label>Текст <textarea v-model="form.body" rows="12" /></label>
      <div class="preview">
        <h2>Предпросмотр</h2>
        <div v-html="preview" />
      </div>
      <label>Часы <input v-model="form.hours"></label>
      <label>Цена <input v-model="form.price"></label>
      <label>Как добраться <textarea v-model="form.howToGet" rows="3" /></label>
      <label>Широта <input v-model="form.latitude"></label>
      <label>Долгота <input v-model="form.longitude"></label>
      <p
        v-if="!form.latitude || !form.longitude"
        class="warn"
      >
        Нет координат.
      </p>
      <label>SEO title <input v-model="form.seoTitle"></label>
      <p>Заголовок в поиске: {{ finalTitle }} ({{ finalTitle.length }})</p>
      <p
        v-if="titleHint"
        class="warn"
      >
        {{ titleHint }}
      </p>
      <label>SEO description <textarea v-model="form.seoDescription" rows="3" /></label>
      <p>Описание: {{ finalDescription.length }} знаков</p>
      <p
        v-if="descriptionHint"
        class="warn"
      >
        {{ descriptionHint }}
      </p>
      <label>Картинка для соцсетей <input
        v-model="form.ogImage"
        placeholder="/media/..."
      ></label>
      <label><input
        v-model="form.noindex"
        type="checkbox"
      > Не индексировать</label>
      <p v-if="placeId">
        <a :href="`/preview/${form.slug}`">Предпросмотр черновика</a>
      </p>
      <div class="serp">
        <strong>{{ finalTitle }}</strong>
        <div>k39.online/{{ form.slug }}</div>
        <p>{{ finalDescription }}</p>
      </div>
      <button type="submit">
        Сохранить
      </button>
      <p v-if="message">
        {{ message }}
      </p>
    </form>
  </main>
</template>

<script setup lang="ts">
import { renderMarkdown } from '~~/shared/markdown'
import { descriptionWarning, metaDescription, pageTitle, slugError, titleWarning, transliterateSlug } from '~~/shared/seo'

const props = defineProps<{ placeId?: string }>()
const meta = await $fetch('/api/admin/meta')
const places = props.placeId ? await $fetch('/api/admin/places') : []
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
    await $fetch(`/api/admin/places/${props.placeId}`, { method: 'PATCH', body: payload })
    message.value = 'Сохранено'
    return
  }
  const created = await $fetch('/api/admin/places', { method: 'POST', body: payload })
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
