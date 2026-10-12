<template>
  <main class="admin">
    <header class="head">
      <h1>Аналитика</h1>
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
      <p class="realtime">
        За 30 минут: {{ report.realtime.visitors }} посетителей, {{ report.realtime.pageviews }} просмотров
      </p>
      <section class="stats">
        <article>
          <p class="label">
            Посетители
          </p>
          <p class="value">
            {{ report.overview.visitors }}
          </p>
          <p class="trend">
            {{ trend(report.overview.trend.visitors) }}
          </p>
        </article>
        <article>
          <p class="label">
            Сессии
          </p>
          <p class="value">
            {{ report.overview.sessions }}
          </p>
          <p class="trend">
            {{ trend(report.overview.trend.sessions) }}
          </p>
        </article>
        <article>
          <p class="label">
            Просмотры
          </p>
          <p class="value">
            {{ report.overview.pageviews }}
          </p>
          <p class="trend">
            {{ trend(report.overview.trend.pageviews) }}
          </p>
        </article>
        <article>
          <p class="label">
            Отказы
          </p>
          <p class="value">
            {{ report.overview.bounceRate }}%
          </p>
        </article>
        <article>
          <p class="label">
            Вовлечение
          </p>
          <p class="value">
            {{ report.overview.avgEngagedSec }} с
          </p>
        </article>
      </section>
      <section>
        <h2>Каналы</h2>
        <ul class="bars">
          <li
            v-for="row in report.channels"
            :key="row.channel"
          >
            <span>{{ channelLabel(row.channel) }}</span>
            <span class="track"><i :style="{ width: `${row.share}%` }" /></span>
            <b>{{ row.pageviews }}</b>
          </li>
        </ul>
      </section>
      <section class="split">
        <div>
          <h2>Страницы</h2>
          <table>
            <tbody>
              <tr
                v-for="row in report.topPages"
                :key="row.path"
              >
                <td>{{ row.path }}</td>
                <td>{{ row.pageviews }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <h2>Входы из поиска</h2>
          <table>
            <tbody>
              <tr
                v-for="row in report.landing"
                :key="row.path"
              >
                <td>{{ row.path }}</td>
                <td>{{ row.pageviews }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2>Источники переходов</h2>
        <table>
          <tbody>
            <tr
              v-for="row in report.referrers"
              :key="row.host"
            >
              <td>{{ row.host }}</td>
              <td>{{ row.pageviews }}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <section v-if="report.queries.length">
        <h2>Запросы</h2>
        <table>
          <tbody>
            <tr
              v-for="row in report.queries"
              :key="`${row.engine}-${row.query}-${row.page}`"
            >
              <td>{{ row.engine }}</td>
              <td>{{ row.query }}</td>
              <td>{{ row.page || 'весь сайт' }}</td>
              <td>{{ row.clicks }} / {{ row.impressions }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin-only'] })
useHead({ title: 'Аналитика | K39' })

interface Report {
  overview: {
    visitors: number
    sessions: number
    pageviews: number
    bounceRate: number
    avgEngagedSec: number
    trend: { visitors: number | null, sessions: number | null, pageviews: number | null }
  }
  realtime: { visitors: number, pageviews: number }
  channels: Array<{ channel: string, pageviews: number, share: number }>
  topPages: Array<{ path: string, pageviews: number }>
  landing: Array<{ path: string, pageviews: number }>
  referrers: Array<{ host: string, pageviews: number }>
  queries: Array<{ engine: string, query: string, page: string, clicks: number, impressions: number }>
}

const periods = [
  { value: '24h', label: '24 часа' },
  { value: '7d', label: '7 дней' },
  { value: '28d', label: '28 дней' },
  { value: '90d', label: '90 дней' },
]
const period = ref('28d')
const { data: report, pending } = await useFetch<Report>('/api/admin/analytics', {
  query: computed(() => ({ period: period.value })),
})

function trend(value: number | null) {
  if (value == null) {
    return 'нет базы'
  }
  return value > 0 ? `+${value}%` : `${value}%`
}

function channelLabel(channel: string) {
  const labels: Record<string, string> = {
    'direct': 'прямые',
    'internal': 'внутри сайта',
    'referral': 'ссылки',
    'paid': 'реклама',
    'organic:yandex': 'Яндекс',
    'organic:google': 'Google',
    'organic:other': 'другой поиск',
    'social:vk': 'ВКонтакте',
    'social:tg': 'Telegram',
    'social:other': 'соцсети',
  }
  return labels[channel] || channel
}
</script>

<style scoped>
.admin { max-width: 64rem; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
.head { display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
.head :deep(.control) { width: 10rem; }
h1 { margin: 0; font-family: var(--font-display); }
h2 { margin: 1.6rem 0 0.6rem; font-size: 1.25rem; }
.muted, .realtime { color: var(--muted); }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr)); gap: 0.7rem; margin-top: 1rem; }
.stats article { padding: 0.8rem; border: 1px solid var(--color-line); border-radius: var(--radius-md); background: var(--surface); }
.label { margin: 0; color: var(--muted); font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase; }
.value { margin: 0.25rem 0 0; font-family: var(--font-display); font-size: 1.8rem; }
.trend { margin: 0.15rem 0 0; color: var(--color-pine); font-size: 0.85rem; }
.bars { margin: 0; padding: 0; list-style: none; }
.bars li { display: grid; grid-template-columns: 8.5rem 1fr 3rem; gap: 0.6rem; align-items: center; margin: 0.35rem 0; }
.track { height: 0.55rem; border-radius: 99px; background: var(--color-sand); }
.track i { display: block; height: 100%; border-radius: inherit; background: var(--color-brick); }
.split { display: grid; gap: 1.2rem; }
table { width: 100%; border-collapse: collapse; }
td { padding: 0.35rem 0.4rem; border-bottom: 1px solid var(--color-line); }
td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
@media (min-width: 800px) {
  .split { grid-template-columns: 1fr 1fr; }
}
</style>
