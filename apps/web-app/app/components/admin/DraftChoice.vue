<template>
  <section
    :id="choiceId"
    class="choice"
  >
    <h2>{{ choice === 'apply' ? 'Применить черновик?' : 'Что оставить?' }}</h2>
    <p>{{ text }}</p>
    <div class="choice-actions">
      <UiButton
        v-if="choice === 'save'"
        type="button"
        variant="sea"
        :disabled="busy"
        @click="emit('save')"
      >
        Сохранить форму и отбросить черновик
      </UiButton>
      <UiButton
        type="button"
        :disabled="busy"
        @click="emit('apply')"
      >
        Применить черновик
      </UiButton>
      <UiButton
        type="button"
        variant="quiet"
        :disabled="busy"
        @click="emit('back')"
      >
        Вернуться к форме
      </UiButton>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  choice: 'save' | 'apply'
  choiceId: string
  text: string
  busy?: boolean
}>()

const emit = defineEmits<{
  save: []
  apply: []
  back: []
}>()
</script>

<style scoped>
.choice {
  padding: var(--space-4);
  border: 1px solid var(--color-line);
  border-left: 4px solid var(--color-brick);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.choice h2 {
  margin: 0 0 var(--space-2);
  font-family: var(--font-display);
  font-size: var(--step-1);
  font-weight: 700;
}

.choice p {
  margin: 0 0 var(--space-3);
  max-width: 62ch;
}

.choice-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.choice-actions :deep(.btn) {
  flex: 1 1 14rem;
  height: auto;
  min-height: 2.6rem;
  white-space: normal;
  text-align: center;
}
</style>
