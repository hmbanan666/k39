<template>
  <CheaperPage :page="page" />
</template>

<script setup lang="ts">
import type { CheaperPageData } from '~/components/CheaperPage.vue'

const route = useRoute()
const page = await fetchPublic<CheaperPageData>('/api/public/cheaper', {
  region: String(route.params.region),
})
</script>
