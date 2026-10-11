<template>
  <main class="admin">
    <h1>Админка K39</h1>
    <p>Черновики, проверка и публикация. Карта снаружи скрыта, пока не включён FEATURE_MAP.</p>
    <p><a href="/admin/places">Места</a></p>
    <p><a href="/admin/routes">Маршруты</a></p>
    <p><a href="/admin/collections">Подборки</a></p>
    <p><a href="/admin/taxonomy">Разделы</a></p>
    <p><a href="/admin/media">Медиа</a></p>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin-only'] })
useHead({ title: 'Админка | K39' })
</script>

<style scoped>
.admin { max-width: 40rem; margin: 0 auto; padding: 1.5rem; }
</style>
