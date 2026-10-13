<template>
  <section
    class="picker"
    aria-label="Подобрать под себя"
  >
    <div
      v-for="key in questions"
      :key="key"
      class="question"
      role="group"
      :aria-labelledby="`picker-${key}`"
    >
      <span
        :id="`picker-${key}`"
        class="label"
      >{{ QUESTIONS[key].label }}</span>
      <div class="chips">
        <button
          v-for="option in QUESTIONS[key].options"
          :key="option.value"
          type="button"
          class="chip"
          :aria-pressed="selected(key, option.value)"
          @click="emit('toggle', key, option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
    <p
      class="status"
      aria-live="polite"
    >
      <template v-if="active">
        Подходит под ваш выбор: {{ fitting }} из {{ total }}. Они выше, остальное ниже.
        <button
          type="button"
          class="reset"
          @click="emit('reset')"
        >
          Сбросить
        </button>
      </template>
      <template v-else>
        Выберите, что вам ближе, и подходящие идеи и места поднимутся выше.
      </template>
    </p>
  </section>
</template>

<script setup lang="ts">
import type { PickerQuestion, PickerState } from '~~/shared/page-modules'
import { PICKER_QUESTIONS, pickerActive } from '~~/shared/page-modules'

const props = defineProps<{
  questions: PickerQuestion[]
  state: PickerState
  fitting: number
  total: number
}>()

const emit = defineEmits<{
  toggle: [question: PickerQuestion, value: string]
  reset: []
}>()

const QUESTIONS = PICKER_QUESTIONS
const active = computed(() => pickerActive(props.state))

function selected(key: PickerQuestion, value: string) {
  return Boolean(props.state[key]?.includes(value))
}
</script>

<style scoped>
.picker {
  display: grid;
  gap: 0.8rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--color-line);
  border-radius: 8px;
  background: var(--color-surface);
}
.question {
  display: grid;
  gap: 0.4rem;
}
.label {
  font-weight: 700;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.chip {
  min-height: 2.25rem;
  padding: 0.25rem 0.85rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
  font-size: 0.92rem;
  cursor: pointer;
  transition: background-color var(--duration-fast), border-color var(--duration-fast);
}
.chip:hover { border-color: var(--color-brick); }
.chip[aria-pressed="true"] {
  border-color: var(--color-brick);
  background: var(--color-brick);
  color: #fff;
}
.chip:focus-visible,
.reset:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
.status {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}
.reset {
  margin-left: 0.3rem;
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-sea);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}
@media (min-width: 900px) {
  .question {
    grid-template-columns: 11rem 1fr;
    align-items: start;
  }
  .label { padding-top: 0.45rem; }
}
</style>
