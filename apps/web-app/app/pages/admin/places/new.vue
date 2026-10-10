<template>
  <AdminPlaceForm />
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin-only'] })
</script>
