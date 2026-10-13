<template>
  <VenueListing :page="payload.page" />
</template>

<script setup lang="ts">
import type { SeoDocument } from '~~/shared/seo'

const payload = await fetchPublic<{
  kind: 'listing'
  page: {
    doc: SeoDocument
    h1: string
    summary: string
    region: { slug: string, title: string } | null
    kind: { slug: string, label: string, plural: string } | null
    regions: Array<{ slug: string, title: string }>
    kinds: Array<{ slug: string, label: string }>
    items: Array<{
      href: string
      name: string
      kindLabel: string
      address: string | null
      stale: boolean
      closed: boolean
      price: string
    }>
  }
}>('/api/public/zavedeniya')
usePublicHead(payload.page.doc)
</script>
