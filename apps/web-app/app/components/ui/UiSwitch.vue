<template>
  <label class="switch-row">
    <SwitchRoot
      v-model="model"
      class="switch"
    >
      <SwitchThumb class="switch-thumb" />
    </SwitchRoot>
    <span>{{ label }}</span>
  </label>
</template>

<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

defineProps<{ label: string }>()
const model = defineModel<boolean>({ required: true })
</script>

<style scoped>
.switch-row { display: flex; align-items: center; gap: 0.6rem; }
</style>
