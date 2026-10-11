<template>
  <main class="admin">
    <h1>Медиа</h1>
    <form @submit.prevent="upload">
      <label>Файл <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        @change="onFile"
      ></label>
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
      <label>Кредит <input v-model="credit"></label>
      <label>Источник <input v-model="sourceUrl"></label>
      <button
        type="submit"
        :disabled="!alt.trim() || !file"
      >
        Загрузить
      </button>
      <p v-if="saved">
        Сохранено: {{ saved }}
      </p>
    </form>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin-only'] })
const alt = ref('')
const credit = ref('')
const sourceUrl = ref('')
const file = ref<File | null>(null)
const saved = ref('')

function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
}

async function upload() {
  if (!file.value || !alt.value.trim()) {
    return
  }
  const body = new FormData()
  body.set('file', file.value)
  body.set('alt', alt.value.trim())
  body.set('credit', credit.value)
  body.set('sourceUrl', sourceUrl.value)
  const row = await $fetch('/api/admin/media', { method: 'POST', body })
  saved.value = `/media/${row.filename}`
}
</script>

<style scoped>
.admin { max-width: 40rem; margin: 0 auto; padding: 1.5rem; }
form { display: flex; flex-direction: column; gap: 0.7rem; }
.warn { color: #9b3d2a; }
</style>
