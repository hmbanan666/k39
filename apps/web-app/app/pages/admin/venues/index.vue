<template>
  <main class="admin">
    <h1>Заведения</h1>
    <p><a href="/admin/venues/new">Новое заведение</a></p>
    <ul>
      <li
        v-for="venue in venues"
        :key="venue.id"
      >
        <a :href="`/admin/venues/${venue.id}`">{{ venue.name }}</a>
        <span>{{ venue.kind }} / {{ venue.status }} / {{ venue.slug }}</span>
      </li>
    </ul>
  </main>
</template>

<script setup lang="ts">
import { ofetch } from 'ofetch'

definePageMeta({ layout: 'admin', middleware: ['admin-only'] })
const venues = await ofetch<Array<{ id: string, name: string, kind: string, status: string, slug: string }>>('/api/admin/venues')
useHead({ title: 'Заведения | Админка' })
</script>

<style scoped>
.admin { max-width: 46rem; margin: 0 auto; padding: 1.5rem; }
li { display: flex; justify-content: space-between; gap: 1rem; margin: 0.4rem 0; }
</style>
