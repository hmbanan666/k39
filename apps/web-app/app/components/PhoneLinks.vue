<template>
  <p class="phones">
    <template
      v-for="(item, index) in phones"
      :key="`${item.e164}-${index}`"
    >
      <a
        v-if="item.e164"
        :href="`tel:${item.e164}`"
        data-track="outbound"
        data-track-name="phone"
        >{{ item.display }}</a
      >
      <span v-else>{{ item.display }}</span>
    </template>
  </p>
</template>

<script setup lang="ts">
import type { ParsedPhone } from '~~/shared/phone'

defineProps<{ phones: ParsedPhone[] }>()
</script>

<style scoped>
.phones {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
}
</style>
