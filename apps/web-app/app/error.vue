<template>
  <div class="page">
    <PageHeader
      :h1="`Ошибка ${error?.statusCode || ''}`"
      kicker="K39"
      :lede="error?.statusMessage || error?.message || 'Страница не открылась'"
    />
    <UiButton href="/">
      На главную
    </UiButton>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ error: { statusCode: number, statusMessage?: string, message?: string } }>()

useHead({ title: `Ошибка ${props.error.statusCode} | K39` })
</script>
