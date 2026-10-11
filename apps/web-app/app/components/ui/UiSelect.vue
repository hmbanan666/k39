<template>
  <SelectRoot v-model="model">
    <SelectTrigger
      class="control select-trigger"
      type="button"
    >
      <SelectValue />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="select-content">
        <SelectViewport>
          <SelectItem
            v-for="option in options"
            :key="option.value"
            :value="option.value"
            class="select-item"
          >
            <SelectItemText>{{ option.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<script setup lang="ts">
import { SelectContent, SelectItem, SelectItemText, SelectPortal, SelectRoot, SelectTrigger, SelectValue, SelectViewport } from 'reka-ui'

defineProps<{ options: Array<{ value: string, label: string }> }>()
const model = defineModel<string>({ required: true })
</script>
