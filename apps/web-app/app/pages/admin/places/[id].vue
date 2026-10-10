<template>
  <AdminPlaceForm :place-id="id" />
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin-only'] })
const id = String(useRoute().params.id || '')
</script>
