<template>
  <main class="admin">
    <h1>Гостевые сообщения</h1>
    <p class="muted">
      Ничего не публикуется, пока запись не принята. Спор остаётся в очереди. Лицо на фото всегда отклоняется.
    </p>
    <p
      v-if="pending"
      class="muted"
    >
      Загружаем.
    </p>
    <p
      v-else-if="!submissions.length"
      class="muted"
    >
      Очередь пуста.
    </p>
    <article
      v-for="item in submissions"
      :key="item.id"
      class="card"
      :class="{ dispute: item.disputed }"
    >
      <p class="meta">
        <span
          v-if="item.disputed"
          class="flag"
        >Спор</span>
        {{ kindLabel(item.kind) }}
        <a
          v-if="item.subjectPath"
          :href="item.subjectPath"
        >{{ item.subjectTitle }}</a>
        <template v-else>
          {{ item.subjectTitle }}
        </template>
      </p>
      <p class="who">
        {{ item.byline }}
      </p>
      <p
        v-if="item.body"
        class="text"
      >
        {{ item.body }}
      </p>
      <p
        v-if="item.alt"
        class="text"
      >
        Подпись: {{ item.alt }}
      </p>
      <p
        v-if="item.kind === 'correction'"
        class="text"
      >
        {{ correctionLabel(item.correctionKind) }}: {{ item.correctionValue }}
      </p>
      <p v-if="item.sourceUrl">
        <a
          :href="item.sourceUrl"
          rel="nofollow noopener noreferrer"
        >Ссылка для редакции</a>
      </p>
      <p v-if="item.mediaId">
        <a href="/admin/media">Фото в медиатеке</a>
      </p>
      <label class="note">
        Причина для автора
        <textarea
          v-model="notes[item.id]"
          rows="2"
        />
      </label>
      <p
        v-if="errors[item.id]"
        class="error"
      >
        {{ errors[item.id] }}
      </p>
      <div class="row">
        <button
          type="button"
          @click="decide(item.id, 'accept')"
        >
          Принять
        </button>
        <button
          type="button"
          @click="decide(item.id, 'reject')"
        >
          Отклонить
        </button>
        <button
          v-if="!item.disputed"
          type="button"
          @click="decide(item.id, 'dispute')"
        >
          Это спор
        </button>
      </div>
    </article>

    <h2>Сигналы без факта</h2>
    <p
      v-if="!signals.length"
      class="muted"
    >
      Открытых сигналов без факта нет.
    </p>
    <article
      v-for="signal in signals"
      :key="signal.id"
      class="card"
    >
      <p>{{ signal.pageType }} · {{ signal.path }}</p>
      <p
        v-if="signalText(signal.proposal)"
        class="text"
      >
        {{ signalText(signal.proposal) }}
      </p>
      <button
        type="button"
        @click="dismiss(signal.id)"
      >
        Закрыть сигнал
      </button>
    </article>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin-only'] })
useHead({ title: 'Гости | K39' })

interface Submission {
  id: string
  kind: string
  body: string
  alt: string
  correctionKind: string | null
  correctionValue: string
  sourceUrl: string | null
  disputed: boolean
  mediaId: string | null
  byline: string
  subjectTitle: string
  subjectPath: string
}

interface Signal {
  id: string
  path: string | null
  pageType: string | null
  proposal: unknown
}

const { data, pending, refresh } = await useFetch<{ submissions: Submission[], signals: Signal[] }>('/api/admin/guests')
const submissions = computed(() => data.value?.submissions ?? [])
const signals = computed(() => data.value?.signals ?? [])
const notes = reactive<Record<string, string>>({})
const errors = reactive<Record<string, string>>({})

function kindLabel(kind: string) {
  if (kind === 'review') {
    return 'Отзыв'
  }
  if (kind === 'tip') {
    return 'Совет'
  }
  if (kind === 'photo') {
    return 'Фото'
  }
  return 'Поправка'
}

function correctionLabel(kind: string | null) {
  const labels: Record<string, string> = {
    hours: 'Часы',
    phone: 'Телефон',
    address: 'Адрес',
    status: 'Статус',
    price: 'Цена',
    other: 'Другое',
  }
  return kind ? labels[kind] || kind : 'Поправка'
}

function signalText(proposal: unknown) {
  if (!proposal || typeof proposal !== 'object' || !('text' in proposal)) {
    return ''
  }
  const text = (proposal as { text?: unknown }).text
  return typeof text === 'string' ? text : ''
}

async function decide(id: string, decision: 'accept' | 'reject' | 'dispute') {
  errors[id] = ''
  try {
    await $fetch(`/api/admin/guests/${id}`, {
      method: 'POST',
      body: { decision, note: notes[id] || '' },
    })
    await refresh()
  } catch (reason) {
    const item = reason as { data?: { statusMessage?: string, message?: string }, statusMessage?: string }
    errors[id] = item.data?.statusMessage || item.data?.message || item.statusMessage || 'Не вышло'
  }
}

async function dismiss(id: string) {
  await $fetch(`/api/admin/guests/signals/${id}/dismiss`, { method: 'POST' })
  await refresh()
}
</script>

<style scoped>
.admin { max-width: 46rem; margin: 0 auto; padding: 1.5rem; }
.muted { color: var(--muted); }
.card {
  margin: 1rem 0;
  padding: 1rem;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  background: var(--surface);
}
.card.dispute { border-left: 4px solid var(--color-brick); }
.meta, .who { margin: 0 0 0.35rem; }
.flag {
  margin-right: 0.4rem;
  color: var(--color-brick-dark);
  font-weight: 700;
}
.text { margin: 0.4rem 0; line-height: 1.5; white-space: pre-wrap; }
.note { display: grid; gap: 0.3rem; margin: 0.6rem 0; }
.note textarea {
  width: 100%;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--color-line);
  border-radius: 8px;
  font: inherit;
}
.error { color: var(--color-brick-dark); }
.row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
button {
  padding: 0.4rem 0.7rem;
  border: 1px solid var(--color-line);
  border-radius: 8px;
  background: var(--surface);
  font: inherit;
  cursor: pointer;
}
</style>
