<template>
  <PlaceView :place="place">
    <ContentRenderer :value="doc" />
  </PlaceView>
</template>

<script setup lang="ts">
import { toPlacePage, touristAttraction } from '~/utils/place-page'

const route = useRoute('place-slug')
const slug = Array.isArray(route.params.slug) ? route.params.slug[0] ?? '' : route.params.slug
const { data } = await useAsyncData(`place-${slug}`, () =>
  queryCollection('places').where('slug', '=', slug).first(),
)

if (!data.value) {
  throw createError({ statusCode: 404, statusMessage: 'Место не найдено', fatal: true })
}

const doc = data.value
const place = toPlacePage(doc as unknown as Record<string, unknown>)

useSeoMeta({
  title: place.title,
  description: place.description,
})
useSchemaOrg([touristAttraction(place)])

onMounted(() => {
  useTrack().track('page_view', { placeSlug: place.slug })
})
</script>
