<template>
  <main class="home">
    <h1>Куда сходить в Калининградской области</h1>
    <p>Страница на каждое место: статус, часы, источник и иллюстрированная карта. Не тайлы.</p>
    <p class="links">
      <NuxtLink to="/map/kaliningrad">
        Карта фортов Кёнигсберга
      </NuxtLink>
      <NuxtLink to="/quest/five-forts">
        Квест: 5 фортов
      </NuxtLink>
    </p>
    <h2>С чего начать</h2>
    <ul>
      <li
        v-for="place in featured"
        :key="place.slug"
      >
        <NuxtLink :to="`/place/${place.slug}`">
          {{ place.title }}
        </NuxtLink>
      </li>
    </ul>
  </main>
</template>

<script setup lang="ts">
const { data } = await useAsyncData('home-places', () => queryCollection('places').all())
const featured = computed(() => (data.value ?? []).filter((place) => place.featured))

useSeoMeta({
  title: 'Места Калининградской области',
  description: 'Форты, ворота и маршруты Калининграда: статус, часы, источники и иллюстрированная карта.',
})
</script>

<style scoped>
.home { max-width: 42rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
h1 { font-family: "K39 Display", Georgia, serif; font-size: 2.2rem; line-height: 1.15; }
.links { display: flex; gap: 1rem; flex-wrap: wrap; font-weight: 700; }
</style>
