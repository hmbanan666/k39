<template>
  <MapFortsMap v-if="isForts" />
  <main
    v-else
    class="missing"
  >
    <h1>Карта пока не собрана</h1>
    <p>Иллюстрированная карта для этого района ещё не нарисована.</p>
    <NuxtLink to="/map/kaliningrad">
      Открыть карту фортов Калининграда
    </NuxtLink>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'map' })

const route = useRoute('map-region')
const region = computed(() => Array.isArray(route.params.region) ? route.params.region[0] ?? '' : route.params.region)
const isForts = computed(() => region.value === 'kaliningrad')

useSeoMeta({
  title: () => isForts.value ? 'Форты Кёнигсберга' : 'Карта',
  description: 'Иллюстрированная схема фортов, ворот и бастионов Калининграда.',
})
</script>

<style scoped>
.missing { max-width: 36rem; margin: 4rem auto; padding: 1rem; }
</style>
