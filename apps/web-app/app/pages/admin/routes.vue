<template>
  <main class="admin">
    <h1>Маршруты</h1>
    <form
      v-for="item in items"
      :key="item.id"
      @submit.prevent="save(item)"
    >
      <label>Название <input v-model="item.title"></label>
      <label>Slug <input v-model="item.slug"></label>
      <label>Кратко <textarea v-model="item.summary" rows="2" /></label>
      <label>Текст <textarea v-model="item.body" rows="6" /></label>
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
const items = ref(await ofetch('/api/admin/routes'))
async function save(item: { id: string }) {
  await ofetch(`/api/admin/routes/${item.id}`, { method: 'PATCH', body: item })
}
</script>

<style scoped>
.admin { max-width: 46rem; margin: 0 auto; padding: 1.5rem; }
form { display: flex; flex-direction: column; gap: 0.5rem; border-top: 1px solid #e6d5b0; padding: 1rem 0; }
</style>
