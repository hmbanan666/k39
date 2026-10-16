<template>
  <main class="admin">
    <h1>Согласия</h1>
    <p class="muted">
      Запись появляется, когда человек нажимает кнопку входа. Эта кнопка и есть согласие, отдельной галочки нет. Отзыв не удаляет строку.
    </p>
    <p v-if="pending">
      Загружаю…
    </p>
    <p v-else-if="!rows.length">
      Записей согласия пока нет.
    </p>
    <div
      v-else
      class="table"
    >
      <table>
        <thead>
          <tr>
            <th>Почта</th>
            <th>Версия</th>
            <th>Когда</th>
            <th>Как</th>
            <th>Статус</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.id"
          >
            <td>{{ row.email }}</td>
            <td>{{ row.version }}</td>
            <td>{{ formatWhen(row.consentedAt) }}</td>
            <td>{{ methodLabel(row.method) }}</td>
            <td>{{ row.withdrawnAt ? `отозвано ${formatWhen(row.withdrawnAt)}` : 'действует' }}</td>
            <td>
              <button
                v-if="!row.withdrawnAt"
                type="button"
                class="btn"
                :disabled="busyId === row.id"
                @click="withdraw(row.id)"
              >
                Отметить отзыв
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p
      v-if="errorText"
      class="warn"
    >
      {{ errorText }}
    </p>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin-only'] })
useHead({ title: 'Согласия | K39' })

interface ConsentRow {
  id: string
  email: string
  version: string
  consentedAt: string
  method: string
  withdrawnAt: string | null
}

const { data, pending, refresh } = await useFetch<{ consents: ConsentRow[] }>('/api/admin/consents')
const rows = computed(() => data.value?.consents ?? [])
const busyId = ref('')
const errorText = ref('')

const methods: Record<string, string> = {
  'sign-in-button': 'кнопка входа',
  'ugc-submit': 'кнопка отправки материала',
}

function methodLabel(method: string) {
  return methods[method] ?? method
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Kaliningrad',
  })
}

async function withdraw(id: string) {
  busyId.value = id
  errorText.value = ''
  try {
    await $fetch(`/api/admin/consents/${id}/withdraw`, { method: 'POST' })
    await refresh()
  } catch {
    errorText.value = 'Не удалось отметить отзыв.'
  } finally {
    busyId.value = ''
  }
}
</script>

<style scoped>
.admin { max-width: 64rem; margin: 0 auto; padding: 1.5rem; }
.muted { color: var(--color-sea); }
.table { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 0.55rem 0.7rem; border-bottom: 1px solid var(--color-line); text-align: left; vertical-align: top; }
.warn { color: var(--color-brick-dark); }
</style>
