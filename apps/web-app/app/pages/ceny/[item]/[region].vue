<template>
  <PriceListing
    :page="page"
    :from="from"
  />
</template>

<script setup lang="ts">
import type { PriceListingData } from '~/components/PriceListing.vue'

const route = useRoute()
const fromQuery = route.query.from
const from = typeof fromQuery === 'string' ? fromQuery : ''
const page = await fetchPublic<PriceListingData>('/api/public/ceny', {
  item: String(route.params.item),
  region: String(route.params.region),
})
</script>
