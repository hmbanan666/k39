<template>
  <VenueForm />
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin-only'] })
useHead({ title: 'Новое заведение | Админка' })
</script>
