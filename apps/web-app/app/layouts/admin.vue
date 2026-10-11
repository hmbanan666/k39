<template>
  <div>
    <header class="admin-bar">
      <a href="/admin">Админка</a>
      <a href="/admin/places">Места</a>
      <a href="/admin/routes">Маршруты</a>
      <a href="/admin/collections">Подборки</a>
      <a href="/admin/taxonomy">Разделы</a>
      <a href="/admin/media">Медиа</a>
      <a href="/">На сайт</a>
    </header>
    <slot />
  </div>
</template>

<script setup lang="ts">
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<style scoped>
.admin-bar { display: flex; gap: 1rem; padding: 0.8rem 1rem; border-bottom: 1px solid #e6d5b0; }
</style>
