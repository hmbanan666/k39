<template>
  <PriceListing :page="page" />
</template>

<script setup lang="ts">
import type { PriceListingData } from '~/components/PriceListing.vue'

const route = useRoute()
const page = await fetchPublic<PriceListingData>('/api/public/ceny', {
  item: String(route.params.item),
  region: String(route.params.region),
})
</script>
