<template>
  <textarea
    v-model="model"
    class="control"
    :rows="rows"
  />
</template>

<script setup lang="ts">
withDefaults(defineProps<{ rows?: number }>(), { rows: 4 })
const model = defineModel<string>({ required: true })
</script>
