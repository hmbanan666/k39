<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger
      class="btn btn-quiet menu-trigger"
      type="button"
    >
      <slot name="trigger"> Меню </slot>
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" />
      <DialogContent class="dialog-content">
        <DialogTitle class="dialog-title">
          {{ title }}
        </DialogTitle>
        <slot />
        <DialogClose
          class="btn btn-quiet"
          type="button"
        >
          Закрыть
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui'

defineProps<{ title: string }>()
const open = defineModel<boolean>('open', { default: false })
</script>

<style scoped>
.dialog-title {
  margin-top: 0;
  font-family: var(--font-display);
  font-size: var(--step-1);
}
.menu-trigger {
  margin-left: auto;
}
</style>
