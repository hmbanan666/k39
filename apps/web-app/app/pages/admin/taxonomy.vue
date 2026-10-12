<template>
  <main class="admin">
    <h1>Разделы и регионы</h1>
    <h2>Разделы</h2>
    <form
      v-for="item in meta.categories"
      :key="item.id"
      @submit.prevent="saveCategory(item)"
    >
      <label>Название <input v-model="item.title"></label>
      <label>Кратко <textarea v-model="item.description" rows="3" /></label>
      <label>Текст <textarea v-model="item.body" rows="8" /></label>
      <p>Markdown. Раздел «Частые вопросы» попадает в результаты поиска.</p>
      <label>SEO title <input v-model="item.seoTitle"></label>
      <p>{{ (item.seoTitle || item.title || '').length }} знаков в заголовке</p>
      <label>SEO description <textarea
        v-model="item.seoDescription"
        rows="2"
      /></label>
      <p>{{ (item.seoDescription || item.description || '').length }} знаков в описании</p>
      <label>Картинка для соцсетей <input v-model="item.ogImage"></label>
      <label><input
        v-model="item.noindex"
        type="checkbox"
      > Не индексировать</label>
      <button type="submit">
        Сохранить раздел
      </button>
    </form>
    <h2>Регионы</h2>
    <form
      v-for="item in meta.regions"
      :key="item.id"
      @submit.prevent="saveRegion(item)"
    >
      <label>Название <input v-model="item.title"></label>
      <label>Описание <textarea v-model="item.description" rows="3" /></label>
      <button type="submit">
        Сохранить регион
      </button>
    </form>
  </main>
</template>

<script setup lang="ts">
import { ofetch } from 'ofetch'

definePageMeta({ layout: 'admin', middleware: ['admin-only'] })
const meta = reactive(await ofetch('/api/admin/meta'))
async function saveCategory(item: { id: string }) {
  await ofetch(`/api/admin/categories/${item.id}`, { method: 'PATCH', body: item })
}
async function saveRegion(item: { id: string }) {
  await ofetch(`/api/admin/regions/${item.id}`, { method: 'PATCH', body: item })
}
</script>

<style scoped>
.admin { max-width: 46rem; margin: 0 auto; padding: 1.5rem; }
form { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
</style>
