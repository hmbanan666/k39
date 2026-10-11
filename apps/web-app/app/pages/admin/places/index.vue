<template>
  <main class="admin">
    <h1>Места</h1>
    <p><a href="/admin/places/new">Новое место</a></p>
    <ul>
      <li
        v-for="place in places"
        :key="place.id"
      >
        <a :href="`/admin/places/${place.id}`">{{ place.title }}</a>
        <span>{{ place.publicationStatus }} / {{ place.slug }}</span>
      </li>
    </ul>
  </main>
</template>

<script setup lang="ts">
import { ofetch } from 'ofetch'

definePageMeta({ layout: 'admin', middleware: ['admin-only'] })
const places = await ofetch('/api/admin/places')
useHead({ title: 'Места | Админка' })
</script>

<style scoped>
.admin { max-width: 46rem; margin: 0 auto; padding: 1.5rem; }
li { display: flex; justify-content: space-between; gap: 1rem; margin: 0.4rem 0; }
</style>
