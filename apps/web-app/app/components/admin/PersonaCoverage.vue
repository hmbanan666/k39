<template>
  <section class="coverage">
    <h2>Покрытие персон</h2>
    <p class="muted">
      Какую долю нужных персоне блоков страница уже даёт. Только данные страницы, без трафика. Красная ячейка: персона
      назначена, покрытие ниже {{ COVERAGE_GAP }}. Жирным основная персона. Без персон: {{ data?.untargeted ?? 0 }} стр.
    </p>
    <p
      v-if="error"
      class="error"
    >
      Не удалось загрузить покрытие.
    </p>
    <div
      v-else-if="rows.length"
      class="scroll"
    >
      <table>
        <thead>
          <tr>
            <th>Страница</th>
            <th
              v-for="persona in PERSONAS"
              :key="persona.code"
              :title="persona.job"
              class="num"
            >
              {{ persona.title }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.path"
          >
            <td>
              <NuxtLink :to="row.path">
                {{ row.title }}
              </NuxtLink>
            </td>
            <td
              v-for="cell in row.cells"
              :key="cell.code"
              class="num"
              :class="{ target: cell.weight, primary: cell.primary, gap: cell.gap }"
              :title="cell.missing.length ? `Нет: ${cell.missing.map(blockTitle).join(', ')}` : 'Все блоки есть'"
            >
              {{ cell.score }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <template v-if="tasks.length">
      <h3>Что добавить</h3>
      <ul class="tasks">
        <li
          v-for="task in tasks"
          :key="task.key"
        >
          {{ task.text }}
        </li>
      </ul>
    </template>
  </section>
</template>

<script setup lang="ts">
import type { PageKind } from '~~/shared/scoring'
import { blockTitle, COVERAGE_GAP } from '~~/shared/persona-coverage'
import { PERSONAS, personaTitle } from '~~/shared/personas'

interface Cell {
  code: string
  score: number
  missing: string[]
  weight: number | null
  primary: boolean
  gap: boolean
}
interface Row {
  pageType: PageKind
  entityId: string
  path: string
  title: string
  cells: Cell[]
}

const { data, error } = await useFetch<{ rows: Row[]; untargeted: number }>('/api/admin/persona-coverage')
const rows = computed(() => data.value?.rows ?? [])
const tasks = computed(() =>
  rows.value.flatMap((row) =>
    row.cells
      .filter((cell) => cell.gap)
      .map((cell) => ({
        key: `${row.path}:${cell.code}`,
        text: `${row.title}: для «${personaTitle(cell.code)}» добавить ${cell.missing.map(blockTitle).join(', ')}`,
      })),
  ),
)
</script>

<style scoped>
.coverage {
  margin-top: 2rem;
}
h3 {
  margin: 1.2rem 0 0.5rem;
  font-size: 1.05rem;
}
.muted {
  color: var(--muted);
}
.error {
  color: var(--color-brick);
}
.scroll {
  overflow-x: auto;
}
table {
  border-collapse: collapse;
  font-size: 0.85rem;
}
th,
td {
  padding: 0.35rem 0.4rem;
  border-bottom: 1px solid var(--color-line);
  text-align: left;
  vertical-align: top;
}
th.num {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-weight: 600;
  white-space: nowrap;
}
.num {
  text-align: center;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}
td.target {
  color: var(--color-ink);
  background: var(--color-sand);
}
td.primary {
  font-weight: 700;
}
td.gap {
  color: var(--color-danger);
}
.tasks {
  margin: 0;
  padding-left: 1.2rem;
  font-size: 0.9rem;
}
</style>
