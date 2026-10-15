<template>
  <main class="admin">
    <h1>Админка K39</h1>
    <p>Черновики, проверка и публикация.</p>
    <p><a href="/admin/places">Места</a></p>
    <p><a href="/admin/venues">Заведения</a></p>
    <p><a href="/admin/routes">Маршруты</a></p>
    <p><a href="/admin/collections">Подборки</a></p>
    <p><a href="/admin/taxonomy">Разделы</a></p>
    <p><a href="/admin/media">Медиа</a></p>
    <p><a href="/admin/analytics">Аналитика</a></p>
    <p><a href="/admin/search">Поиск по сайту</a></p>
    <p><a href="/admin/content-scores">Оценки</a></p>
    <p><a href="/admin/consents">Согласия</a></p>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin-only'] })
useHead({ title: 'Админка | K39' })
</script>

<style scoped>
.admin { max-width: 40rem; margin: 0 auto; padding: 1.5rem; }
</style>
