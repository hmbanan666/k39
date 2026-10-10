<template>
  <div class="error-page">
    <h1>Ошибка {{ error?.statusCode }}</h1>
    <p>{{ error?.statusMessage || error?.message || 'Страница не открылась' }}</p>
    <button
      type="button"
      @click="handleError"
    >
      На главную
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ error: { statusCode: number, statusMessage?: string, message?: string } }>()

function handleError() {
  clearError({ redirect: '/' })
}

useHead({ title: `Ошибка ${props.error.statusCode}` })
</script>

<style scoped>
.error-page { max-width: 28rem; margin: 4rem auto; text-align: center; padding: 1rem; }
button { margin-top: 1rem; border: 1.4px solid #3a2e24; background: #9b3d2a; color: #fbf3e2; border-radius: 999px; padding: 0.6rem 1rem; font-weight: 700; }
</style>
