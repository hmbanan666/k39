<template>
  <AccordionRoot
    type="multiple"
    :default-value="defaultValue"
    class="accordion"
  >
    <AccordionItem
      v-for="item in items"
      :key="item.value"
      :value="item.value"
      class="accordion-item"
    >
      <AccordionHeader>
        <AccordionTrigger class="accordion-trigger">
          {{ item.title }}
        </AccordionTrigger>
      </AccordionHeader>
      <AccordionContent class="accordion-content">
        <ProseHtml :html="item.html" />
      </AccordionContent>
    </AccordionItem>
  </AccordionRoot>
</template>

<script setup lang="ts">
import { AccordionContent, AccordionHeader, AccordionItem, AccordionRoot, AccordionTrigger } from 'reka-ui'

defineProps<{
  defaultValue: string[]
  items: Array<{ value: string, title: string, html: string }>
}>()
</script>

<style scoped>
.accordion-content { padding-bottom: var(--space-4); color: var(--text); }
</style>
