<template>
  <main class="admin">
    <header class="head">
      <h1>Поиск по сайту</h1>
      <UiSelect
        v-model="period"
        :options="periods"
      />
    </header>
    <p
      v-if="pending"
      class="muted"
    >
      Считаю…
    </p>
    <template v-else-if="report">
      <section class="stats">
        <article
          v-for="stat in stats"
          :key="stat.label"
        >
          <p class="label">
            {{ stat.label }}
          </p>
          <p class="value">
            {{ stat.value }}
          </p>
        </article>
      </section>
      <section>
        <h2>Ничего не нашлось</h2>
        <p class="muted">
          Кандидаты в новые страницы или синонимы в описании существующих. «Яндекс и Google» показывает, сколько раз
          поисковики показали нас по тому же тексту.
        </p>
        <table v-if="report.zeroResults.length">
          <thead>
            <tr> <th>Запрос</th><th>Поисков</th><th>Уточнили</th><th>Яндекс и Google</th> </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in report.zeroResults"
              :key="row.query"
            >
              <td>{{ row.query }}</td
              ><td>{{ row.searches }}</td
              ><td>{{ row.refined }}</td
              ><td>{{ row.externalImpressions }}</td>
            </tr>
          </tbody>
        </table>
        <p
          v-else
          class="muted"
        >
          Пусто.
        </p>
      </section>
      <section>
        <h2>Частые запросы</h2>
        <table v-if="report.topQueries.length">
          <thead>
            <tr>
              <th>Запрос</th><th>Поисков</th><th>Результатов</th><th>С кликом</th><th>Ушли</th><th>Яндекс и Google</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in report.topQueries"
              :key="row.query"
            >
              <td>{{ row.query }}</td
              ><td>{{ row.searches }}</td
              ><td>{{ row.avgResults }}</td
              ><td>{{ row.clicked }}</td
              ><td>{{ row.exits }}</td
              ><td>{{ row.externalImpressions }}</td>
            </tr>
          </tbody>
        </table>
        <p
          v-else
          class="muted"
        >
          Пока никто не искал.
        </p>
      </section>
      <div class="split">
        <section>
          <h2>Клики по позициям</h2>
          <table>
            <tbody>
              <tr
                v-for="row in report.positions"
                :key="row.position"
              >
                <td>{{ row.position }}</td
                ><td>{{ row.clicks }} · {{ row.ctr }}%</td>
              </tr>
            </tbody>
          </table>
        </section>
        <section>
          <h2>Откуда ищут</h2>
          <table>
            <tbody>
              <tr
                v-for="row in report.surfaces"
                :key="row.surface"
              >
                <td>{{ surfaceLabel(row.surface) }}</td
                ><td>{{ row.searches }}</td>
              </tr>
            </tbody>
          </table>
          <h2>Как пришли</h2>
          <table>
            <tbody>
              <tr
                v-for="row in report.arrivals"
                :key="row.channel + row.landingPath"
              >
                <td>{{ row.channel }} → {{ row.landingPath }}</td
                ><td>{{ row.sessions }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </template>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin-only'] })
useHead({ title: 'Поиск по сайту | K39' })

interface Report {
  totals: {
    searches: number
    sessions: number
    zeroResults: number
    zeroRate: number
    clickRate: number
    refinementRate: number
    exitRate: number
  }
  topQueries: Array<{
    query: string
    searches: number
    avgResults: number
    clicked: number
    exits: number
    externalImpressions: number
  }>
  zeroResults: Array<{ query: string; searches: number; refined: number; externalImpressions: number }>
  positions: Array<{ position: number; clicks: number; ctr: number }>
  surfaces: Array<{ surface: string; searches: number }>
  arrivals: Array<{ channel: string; landingPath: string | null; sessions: number }>
}

const periods = [
  { value: '24h', label: '24 часа' },
  { value: '7d', label: '7 дней' },
  { value: '28d', label: '28 дней' },
  { value: '90d', label: '90 дней' },
]
const period = ref('28d')
const { data: report, pending } = await useFetch<Report>('/api/admin/search', {
  query: computed(() => ({ period: period.value })),
})

const stats = computed(() => {
  const totals = report.value?.totals
  if (!totals) {
    return []
  }
  return [
    { label: 'Поиски', value: totals.searches },
    { label: 'Сессии', value: totals.sessions },
    { label: 'Без результата', value: `${totals.zeroRate}%` },
    { label: 'С кликом', value: `${totals.clickRate}%` },
    { label: 'Уточнили', value: `${totals.refinementRate}%` },
    { label: 'Ушли без клика', value: `${totals.exitRate}%` },
  ]
})

function surfaceLabel(surface: string) {
  const labels: Record<string, string> = { header: 'шапка', page: 'страница поиска', 404: 'страница 404' }
  return labels[surface] || surface || 'не указано'
}
</script>

<style scoped>
.admin {
  max-width: 64rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}
.head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}
.head :deep(.control) {
  width: 10rem;
}
.muted {
  color: var(--muted);
}
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
  gap: 0.7rem;
  margin-top: 1rem;
}
.stats article {
  padding: 0.8rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--surface);
}
.label {
  margin: 0;
  color: var(--muted);
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.value {
  margin: 0.25rem 0 0;
  font-family: var(--font-display);
  font-size: 1.8rem;
}
.split {
  display: grid;
  gap: 1.2rem;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th {
  padding: 0.35rem 0.4rem;
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 500;
  text-align: left;
}
td {
  padding: 0.35rem 0.4rem;
  border-bottom: 1px solid var(--color-line);
}
td:not(:first-child),
th:not(:first-child) {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
@media (min-width: 800px) {
  .split {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
