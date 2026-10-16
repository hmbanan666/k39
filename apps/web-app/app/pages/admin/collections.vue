<template>
  <main class="admin">
    <h1>Подборки</h1>
    <form
      v-for="item in items"
      :key="item.id"
      @submit.prevent="save(item)"
    >
      <label>Название <input v-model="item.title"></label>
      <label>Slug <input v-model="item.slug"></label>
      <label>Кратко <textarea v-model="item.summary" rows="2" /></label>
      <label>Текст
        <textarea
          v-model="item.body"
          rows="6"
          :disabled="hasModules(item)"
        />
      </label>
      <p v-if="hasModules(item)">
        Страница собрана из модулей. Этот текст на сайте не показывается.
      </p>
      <label>Статус
        <select v-model="item.publicationStatus">
          <option value="draft">черновик</option>
          <option value="review">на проверке</option>
          <option value="published">опубликовано</option>
          <option value="archived">в архиве</option>
        </select>
      </label>
      <label>SEO title <input v-model="item.seoTitle"></label>
      <p>{{ (item.seoTitle || item.title || '').length }} знаков в заголовке</p>
      <label>SEO description <textarea
        v-model="item.seoDescription"
        rows="2"
      /></label>
      <p>{{ (item.seoDescription || item.summary || '').length }} знаков в описании</p>
      <label>Картинка для соцсетей <input v-model="item.ogImage"></label>
      <label><input
        v-model="item.noindex"
        type="checkbox"
      > Не индексировать</label>
      <button type="submit">
        Сохранить
      </button>
    </form>
  </main>
</template>

<script setup lang="ts">
import { ofetch } from 'ofetch'

definePageMeta({ layout: 'admin', middleware: ['admin-only'] })
const items = ref(await ofetch('/api/admin/collections'))
function hasModules(item: { modules?: unknown }) {
  return Array.isArray(item.modules) && item.modules.length > 0
}
async function save(item: { id: string, modules?: unknown, body?: string }) {
  const payload: Record<string, unknown> = { ...item }
  if (hasModules(item)) {
    delete payload.body
  }
  await ofetch(`/api/admin/collections/${item.id}`, { method: 'PATCH', body: payload })
}
</script>

<style scoped>
.admin { max-width: 46rem; margin: 0 auto; padding: 1.5rem; }
form { display: flex; flex-direction: column; gap: 0.5rem; border-top: 1px solid #e6d5b0; padding: 1rem 0; }
</style>
