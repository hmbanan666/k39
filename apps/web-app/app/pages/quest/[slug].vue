<template>
  <main class="quest">
    <h1>{{ quest.title }}</h1>
    <ContentRenderer :value="quest" />
    <ol>
      <li
        v-for="(step, index) in steps"
        :key="step.place"
      >
        <NuxtLink :to="`/place/${step.place}`">
          {{ index + 1 }}. {{ step.title }}
        </NuxtLink>
      </li>
    </ol>
    <p>
      <NuxtLink to="/map/kaliningrad">
        Открыть маршрут на карте
      </NuxtLink>
    </p>
  </main>
</template>

<script setup lang="ts">
const route = useRoute('quest-slug')
const slug = Array.isArray(route.params.slug) ? route.params.slug[0] ?? '' : route.params.slug
const { data } = await useAsyncData(`quest-${slug}`, () =>
  queryCollection('quests').where('slug', '=', slug).first(),
)

if (!data.value) {
  throw createError({ statusCode: 404, statusMessage: 'Квест не найден', fatal: true })
}

const quest = data.value
const steps = computed(() => quest.steps ?? [])

useSeoMeta({
  title: () => String(quest.title ?? 'Квест'),
  description: () => String(quest.description ?? ''),
})

onMounted(() => {
  useTrack().track('quest_open', { questSlug: slug })
})
</script>

<style scoped>
.quest { max-width: 42rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
h1 { font-family: "K39 Display", Georgia, serif; }
</style>
