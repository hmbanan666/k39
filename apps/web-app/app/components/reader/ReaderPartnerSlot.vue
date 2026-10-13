<template>
  <PartnerOffer
    v-if="partner"
    :title="partner.title"
    :terms="partner.terms"
    :href="partner.href"
    :anchor="partner.anchor"
  />
</template>

<script setup lang="ts">
import type { ReaderPartner } from '~~/shared/reader-nav'

defineProps<{
  partner?: ReaderPartner | null
}>()
</script>
