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
.admin-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  padding: 0.8rem 1.25rem;
  border-bottom: 1px solid var(--color-line);
  background: var(--surface);
}
.admin-bar a { color: var(--text); font-weight: 700; text-decoration: none; }
</style>
