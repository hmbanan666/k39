<template>
  <input
    v-model="model"
    class="control"
    :type="type"
    :required="required"
    :placeholder="placeholder"
  />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: string
    required?: boolean
    placeholder?: string
  }>(),
  {
    type: 'text',
    required: false,
    placeholder: '',
  },
)
const model = defineModel<string | number>({ required: true })
</script>
