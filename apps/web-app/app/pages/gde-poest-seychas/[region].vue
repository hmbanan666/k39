<template>
  <EatNowPage :page="page" />
</template>

<script setup lang="ts">
import type { EatNowData } from '~/components/EatNowPage.vue'

const route = useRoute()
const page = await fetchPublic<EatNowData>('/api/public/eat-now', { region: String(route.params.region || '') })
</script>
