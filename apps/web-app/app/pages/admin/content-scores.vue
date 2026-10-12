<template>
  <main class="admin">
    <header class="head">
      <div>
        <h1>Оценки страниц</h1>
        <p class="muted">
          Качество, ссылки, индексация и результат. Ночная оценка и кнопка «Пересчитать».
        </p>
      </div>
      <UiButton
        type="button"
        :disabled="refreshing"
        @click="recompute"
      >
        {{ refreshing ? 'Считаю…' : 'Пересчитать' }}
      </UiButton>
    </header>
    <p
      v-if="errorText"
      class="error"
    >
      {{ errorText }}
    </p>
    <p
      v-if="pending && !rows.length"
      class="muted"
    >
      Считаю…
    </p>
    <table v-else>
      <thead>
        <tr>
          <th>
            <button
              type="button"
              @click="toggleSort('title')"
            >
              Страница
            </button>
          </th>
          <th>
            <button
              type="button"
              @click="toggleSort('pageType')"
            >
              Тип
            </button>
          </th>
          <th>
            <button
              type="button"
              @click="toggleSort('total')"
            >
              Итого
            </button>
          </th>
          <th>
            <button
              type="button"
              @click="toggleSort('quality')"
            >
              Качество
            </button>
          </th>
          <th>
            <button
              type="button"
              @click="toggleSort('linking')"
            >
              Ссылки
            </button>
          </th>
          <th>
            <button
              type="button"
              @click="toggleSort('indexing')"
            >
              Индексация
            </button>
          </th>
          <th>
            <button
              type="button"
              @click="toggleSort('results')"
            >
              Результат
            </button>
          </th>
          <th>Проблема</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in sorted"
          :key="row.path"
          :class="{ selected: selectedPath === row.path }"
          @click="openPassport(row.path)"
        >
          <td>
            <b>{{ row.title }}</b>
            <span class="path">{{ row.path }}</span>
          </td>
          <td>{{ kindLabel(row.pageType) }}</td>
          <td class="num">
            {{ row.total }}
          </td>
          <td class="num">
            {{ row.quality }}
          </td>
          <td class="num">
            {{ row.linking }}
          </td>
          <td class="num">
            {{ row.indexing }}
          </td>
          <td class="num">
            {{ row.results }}
          </td>
          <td>{{ row.topIssue ? issueLabel(row.topIssue) : 'нет' }}</td>
        </tr>
      </tbody>
    </table>
    <form
      v-if="passport"
      class="passport"
      @submit.prevent="savePassport"
    >
      <h2>Паспорт {{ passport.path }}</h2>
      <UiField label="Целевые запросы">
        <UiTextarea
          v-model="queriesText"
          :rows="4"
        />
      </UiField>
      <UiField label="Аудитория">
        <UiInput v-model="audience" />
      </UiField>
      <UiField label="Действие">
        <UiSelect
          v-model="action"
          :options="actions"
        />
      </UiField>
      <div class="goals">
        <UiField label="Цель на 30 дней">
          <UiInput
            v-model="goal30"
            type="number"
          />
        </UiField>
        <UiField label="Цель на 90 дней">
          <UiInput
            v-model="goal90"
            type="number"
          />
        </UiField>
      </div>
      <UiField label="Заметки">
        <UiTextarea
          v-model="notes"
          :rows="3"
        />
      </UiField>
      <UiButton
        type="submit"
        :disabled="saving"
      >
        {{ saving ? 'Сохраняю…' : 'Сохранить паспорт' }}
      </UiButton>
      <p
        v-if="saved"
        class="muted"
      >
        Паспорт сохранён. Пересчитайте оценку, чтобы увидеть новые проверки.
      </p>
    </form>
  </main>
</template>

<script setup lang="ts">
import type { PageKind, PrimaryAction, ScoreChecks } from '~~/shared/scoring'
import { issueLabel, pageKindLabel } from '~~/shared/scoring'

definePageMeta({ layout: 'admin', middleware: ['admin-only'] })
useHead({ title: 'Оценки страниц | K39' })

interface ScoreRow {
  path: string
  title: string
  pageType: PageKind
  total: number
  quality: number
  linking: number
  indexing: number
  results: number
  checks: ScoreChecks
  topIssue: string | null
}

interface Passport {
  path: string
  title: string
  targetQueries: string[]
  audience: string | null
  primaryAction: PrimaryAction | null
  goal30d: number | null
  goal90d: number | null
  notes: string | null
}

const actions = [
  { value: '', label: 'Не выбрано' },
  { value: 'build_route', label: 'Собрать маршрут' },
  { value: 'buy_ticket', label: 'Купить билет' },
  { value: 'go_next_place', label: 'Следующее место' },
  { value: 'claim_offer', label: 'Забрать предложение' },
  { value: 'read', label: 'Прочитать' },
]

const sortKey = ref<'title' | 'pageType' | 'total' | 'quality' | 'linking' | 'indexing' | 'results'>('total')
const sortAsc = ref(true)
const refreshing = ref(false)
const saving = ref(false)
const saved = ref(false)
const errorText = ref('')
const selectedPath = ref('')
const passport = ref<Passport | null>(null)
const queriesText = ref('')
const audience = ref('')
const action = ref('')
const goal30 = ref<string | number>('')
const goal90 = ref<string | number>('')
const notes = ref('')

const { data, pending, error, refresh } = await useFetch<{ rows: ScoreRow[] }>('/api/admin/content-scores')
const rows = computed(() => data.value?.rows ?? [])
const sorted = computed(() => {
  const key = sortKey.value
  const direction = sortAsc.value ? 1 : -1
  return [...rows.value].sort((a, b) => {
    const left = a[key]
    const right = b[key]
    if (typeof left === 'string' && typeof right === 'string') {
      return left.localeCompare(right, 'ru') * direction
    }
    return (Number(left) - Number(right) || a.path.localeCompare(b.path)) * direction
  })
})

watch(error, (value) => {
  errorText.value = value ? 'Не удалось загрузить оценки.' : ''
}, { immediate: true })

function kindLabel(kind: PageKind) {
  return pageKindLabel(kind)
}

function toggleSort(key: typeof sortKey.value) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
    return
  }
  sortKey.value = key
  sortAsc.value = key === 'title' || key === 'pageType'
}

async function recompute() {
  refreshing.value = true
  errorText.value = ''
  try {
    const response = await $fetch<{ rows: ScoreRow[] }>('/api/admin/content-scores/refresh', { method: 'POST' })
    data.value = { rows: response.rows }
  } catch {
    errorText.value = 'Не удалось пересчитать.'
  } finally {
    refreshing.value = false
  }
}

async function openPassport(path: string) {
  selectedPath.value = path
  saved.value = false
  const loaded = await $fetch<Passport>('/api/admin/content-scores/passport', { query: { path } })
  passport.value = loaded
  queriesText.value = loaded.targetQueries.join('\n')
  audience.value = loaded.audience || ''
  action.value = loaded.primaryAction || ''
  goal30.value = loaded.goal30d ?? ''
  goal90.value = loaded.goal90d ?? ''
  notes.value = loaded.notes || ''
}

function goalValue(value: string | number) {
  if (value === '' || value == null) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function savePassport() {
  if (!passport.value) {
    return
  }
  saving.value = true
  saved.value = false
  errorText.value = ''
  try {
    await $fetch('/api/admin/content-scores/passport', {
      method: 'PUT',
      body: {
        path: passport.value.path,
        targetQueries: queriesText.value.split('\n').map((line) => line.trim()).filter(Boolean),
        audience: audience.value.trim() || null,
        primaryAction: action.value || null,
        goal30d: goalValue(goal30.value),
        goal90d: goalValue(goal90.value),
        notes: notes.value.trim() || null,
      },
    })
    saved.value = true
    await refresh()
  } catch {
    errorText.value = 'Не удалось сохранить паспорт.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.admin { max-width: 72rem; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
.head { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
h1 { margin: 0; font-family: var(--font-display); }
h2 { margin: 0 0 0.8rem; font-size: 1.25rem; }
.muted { color: var(--muted); }
.error { color: var(--color-brick); }
table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
th, td { padding: 0.45rem 0.4rem; border-bottom: 1px solid var(--color-line); text-align: left; vertical-align: top; }
th button { padding: 0; border: 0; background: none; font: inherit; font-weight: 700; cursor: pointer; }
.num { font-variant-numeric: tabular-nums; text-align: right; }
.path { display: block; color: var(--muted); font-size: 0.85rem; }
tr { cursor: pointer; }
tr.selected { background: var(--color-sand); }
.passport { margin-top: 1.5rem; padding: 1rem; border: 1px solid var(--color-line); border-radius: var(--radius-md); background: var(--surface); display: flex; flex-direction: column; gap: 0.8rem; }
.goals { display: grid; gap: 0.8rem; }
@media (min-width: 700px) {
  .goals { grid-template-columns: 1fr 1fr; }
}
</style>
