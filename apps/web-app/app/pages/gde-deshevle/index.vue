<template>
  <CheaperPage :page="{ ...page, items: [], regionSlug: null }" />
</template>

<script setup lang="ts">
import type { SeoDocument } from '~~/shared/seo'
import type { CheaperCityLink } from '~/components/CheaperPage.vue'

const page = await fetchPublic<{ doc: SeoDocument, cities: CheaperCityLink[] }>('/api/public/cheaper')
</script>
