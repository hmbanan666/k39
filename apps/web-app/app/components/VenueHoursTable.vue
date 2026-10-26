<template>
  <div class="hours">
    <div
      v-if="!editable"
      class="schedule"
      role="note"
    >
      <p>{{ owner ? OWNER_NOTE : EDITOR_NOTE }}</p>
      <ul v-if="lines.length">
        <li
          v-for="line in lines"
          :key="line"
        >
          {{ line }}
        </li>
      </ul>
    </div>
    <template v-if="table">
      <label
        v-for="day in days"
        :key="day.weekday"
        class="day"
      >
        <span>{{ HOURS_WEEKDAY_LABELS[day.weekday] }}</span>
        <select
          v-model="day.state"
          :disabled="!editable"
          :aria-label="`${HOURS_WEEKDAY_LABELS[day.weekday]}: часы`"
        >
          <option
            v-for="option in HOURS_DAY_STATES"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
        <input
          v-model="day.opens"
          placeholder="09:00"
          :disabled="!editable || day.state !== 'open'"
          :aria-label="`${HOURS_WEEKDAY_LABELS[day.weekday]}: открытие`"
        />
        <input
          v-model="day.closes"
          :placeholder="owner ? (day.openEnded ? '?' : '21:00') : 'уточняйте'"
          :disabled="!editable || day.state !== 'open'"
          :aria-label="`${HOURS_WEEKDAY_LABELS[day.weekday]}: закрытие`"
        />
      </label>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { HoursFormDay } from '~~/shared/venue-hours-form'
import { HOURS_DAY_STATES, HOURS_WEEKDAY_LABELS } from '~~/shared/venue-hours-form'

defineProps<{
  /** False: the schedule has seasons, breaks, or another mode. Shown, never sent. */
  editable: boolean
  /** False: no weekly table to show (24/7, by appointment, closed, events). */
  table: boolean
  /** The schedule in words, shown when it is read-only. */
  lines: string[]
  /** The owner cabinet wording instead of the editor wording. */
  owner?: boolean
}>()

const days = defineModel<HoursFormDay[]>('days', { required: true })

const EDITOR_NOTE =
  'Часы заданы расписанием (schedule_set): сезоны, перерывы или особый режим. Здесь они только для просмотра. Сохранение формы их не меняет.'
const OWNER_NOTE =
  'Часы заданы редакцией: сезоны, перерывы или особый режим. Здесь они только для просмотра, сохранение страницы их не меняет. Изменить их может редакция.'
</script>

<style scoped>
.hours {
  display: grid;
  gap: 0.35rem;
}
.schedule {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--color-line);
  border-left: 3px solid var(--color-sea);
  border-radius: 6px;
  background: var(--color-surface);
}
.schedule p {
  margin: 0;
}
.schedule ul {
  margin: 0.4rem 0 0;
  padding-left: 1.1rem;
}
.day {
  display: grid;
  grid-template-columns: 1.6rem minmax(6.5rem, 10.5rem) minmax(3.6rem, 4.6rem) minmax(4.2rem, 5.6rem);
  gap: 0.4rem;
  align-items: center;
  justify-content: start;
}
.day select,
.day input {
  min-width: 0;
  font: inherit;
  padding: 0.4rem 0.35rem;
}
.day :disabled {
  color: var(--color-muted);
  background: transparent;
  border-color: var(--color-line);
}
</style>
