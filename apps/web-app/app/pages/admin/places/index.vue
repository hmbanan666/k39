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
        <span>{{ place.publicationStatus }} / {{ place.slug }}<template v-if="place.pendingDraft"> / есть черновик</template></span>
      </li>
    </ul>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin-only'] })
const requestFetch = useRequestFetch()
const places = await requestFetch<Array<{
  id: string
  title: string
  slug: string
  publicationStatus: string
  pendingDraft?: boolean
}>>('/api/admin/places')
useHead({ title: 'Места | Админка' })
</script>

<style scoped>
.admin { max-width: 46rem; margin: 0 auto; padding: 1.5rem; }
li { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.25rem 1rem; margin: 0.4rem 0; }
</style>
