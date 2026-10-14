<template>
  <EatNowPage :page="page" />
</template>

<script setup lang="ts">
import type { EatNowData } from '~/components/EatNowPage.vue'

const page = await fetchPublic<EatNowData>('/api/public/eat-now')
</script>
