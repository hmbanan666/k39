<template>
  <main class="admin">
    <h1>Заявки на заведения</h1>
    <p
      v-if="pending"
      class="muted"
    >
      Загружаем.
    </p>
    <p
      v-else-if="!claims.length"
      class="muted"
    >
      Очередь пуста.
    </p>
    <article
      v-for="claim in claims"
      :key="claim.id"
      class="claim"
    >
      <h2>{{ claim.venueName }}</h2>
      <p>
        <a :href="`/zavedeniya/${claim.venueSlug}`">Страница</a>
        · {{ claim.userName }} · {{ claim.userEmail }}
      </p>
      <p>
        Канал: {{ claim.channel }}
        <template v-if="claim.destination"> · {{ claim.destination }} </template>
      </p>
      <p v-if="claim.evidence">
        {{ claim.evidence }}
      </p>
      <label>
        <input
          v-model="confirmed[claim.id]"
          type="checkbox"
        />
        Я проверил, что заявитель представляет заведение
      </label>
      <p
        v-if="errors[claim.id]"
        class="error"
      >
        {{ errors[claim.id] }}
      </p>
      <div class="row">
        <button
          type="button"
          @click="decide(claim.id, 'approve')"
        >
          Подтвердить
        </button>
        <button
          type="button"
          @click="decide(claim.id, 'reject')"
        >
          Отклонить
        </button>
      </div>
    </article>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin-only'] })
useHead({ title: 'Заявки | Админка' })

interface Claim {
  id: string
  venueName: string
  venueSlug: string
  userName: string
  userEmail: string
  channel: string
  destination: string | null
  evidence: string | null
}

const { data, pending, refresh } = await useFetch<{ claims: Claim[] }>('/api/admin/claims')
const claims = computed(() => data.value?.claims ?? [])
const confirmed = reactive<Record<string, boolean>>({})
const errors = reactive<Record<string, string>>({})

async function decide(id: string, decision: 'approve' | 'reject') {
  errors[id] = ''
  try {
    await $fetch(`/api/admin/claims/${id}`, {
      method: 'POST',
      body: { decision, confirmed: confirmed[id] === true },
    })
    await refresh()
  } catch (reason) {
    const item = reason as { data?: { statusMessage?: string; message?: string }; statusMessage?: string }
    errors[id] = item.data?.statusMessage || item.data?.message || item.statusMessage || 'Не вышло'
  }
}
</script>

<style scoped>
.admin {
  max-width: 46rem;
  margin: 0 auto;
  padding: 1.5rem;
}
.claim {
  margin: 1rem 0;
  padding: 1rem;
  border: 1px solid var(--color-line);
  border-radius: 12px;
}
.claim h2 {
  margin: 0 0 0.4rem;
  font-size: 1.2rem;
}
.muted {
  color: var(--muted);
}
.error {
  color: var(--color-danger, var(--color-brick));
}
.row {
  display: flex;
  gap: 0.6rem;
}
</style>
