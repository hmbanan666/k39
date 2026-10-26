<template>
  <main class="admin">
    <h1>Подборки</h1>
    <form
      v-for="item in items"
      :key="item.id"
      @submit.prevent="save(item)"
    >
      <AdminPlaceDraftNotice
        v-if="item.pending"
        :pending="item.pending"
        :busy="busyId === item.id"
        :heading-id="`collection-draft-${item.id}`"
        @apply="onApply(item)"
        @discard="onDiscard(item)"
      />
      <label>Название <input v-model="item.title" /></label>
      <label>Slug <input v-model="item.slug" /></label>
      <label
        >Кратко
        <textarea
          v-model="item.summary"
          rows="2"
        />
      </label>
      <label
        >Текст
        <textarea
          v-model="item.body"
          rows="6"
          :disabled="hasModules(item)"
        />
      </label>
      <p v-if="hasModules(item)"> Страница собрана из модулей. Этот текст на сайте не показывается. </p>
      <label
        >Статус
        <select v-model="item.publicationStatus">
          <option value="draft">черновик</option>
          <option value="review">на проверке</option>
          <option value="published">опубликовано</option>
          <option value="archived">в архиве</option>
        </select>
      </label>
      <label>SEO title <input v-model="item.seoTitle" /></label>
      <p>{{ (item.seoTitle || item.title || '').length }} знаков в заголовке</p>
      <label
        >SEO description
        <textarea
          v-model="item.seoDescription"
          rows="2"
        />
      </label>
      <p>{{ (item.seoDescription || item.summary || '').length }} знаков в описании</p>
      <label>Картинка для соцсетей <input v-model="item.ogImage" /></label>
      <label
        ><input
          v-model="item.noindex"
          type="checkbox"
        />
        Не индексировать</label
      >
      <AdminDraftChoice
        v-if="choice[item.id]"
        :choice="chosen(item.id)"
        :choice-id="`collection-draft-choice-${item.id}`"
        :text="choiceText(item)"
        :busy="busyId === item.id"
        @save="saveAndDiscard(item)"
        @apply="confirmApply(item)"
        @back="choice[item.id] = undefined"
      />
      <button
        type="submit"
        :disabled="busyId === item.id"
      >
        Сохранить
      </button>
      <p
        v-if="message[item.id]"
        aria-live="polite"
      >
        {{ message[item.id] }}
      </p>
    </form>
  </main>
</template>

<script setup lang="ts">
import type { FetchError } from 'ofetch'
import type { ContentDraftNotice } from '~~/shared/content-draft-diff'

interface CollectionForm {
  id: string
  title: string
  slug: string
  summary: string | null
  body: string
  publicationStatus: string
  seoTitle: string | null
  seoDescription: string | null
  ogImage: string | null
  noindex: boolean
  modules?: unknown
  pending: ContentDraftNotice | null
}

definePageMeta({ layout: 'admin', middleware: ['admin-only'] })

const requestFetch = useRequestFetch()
const items = ref<CollectionForm[]>(await requestFetch('/api/admin/collections'))
const choice = reactive<Record<string, 'save' | 'apply' | undefined>>({})
const message = reactive<Record<string, string>>({})
const busyId = ref('')
const baseline = ref<Record<string, string>>({})

function snapshot(item: CollectionForm) {
  return JSON.stringify({
    title: item.title,
    slug: item.slug,
    summary: item.summary,
    body: item.body,
    publicationStatus: item.publicationStatus,
    seoTitle: item.seoTitle,
    seoDescription: item.seoDescription,
    ogImage: item.ogImage,
    noindex: item.noindex,
  })
}

function remember() {
  const next: Record<string, string> = {}
  for (const item of items.value) {
    next[item.id] = snapshot(item)
  }
  baseline.value = next
}

remember()

function hasModules(item: { modules?: unknown }) {
  return Array.isArray(item.modules) && item.modules.length > 0
}

function dirty(item: CollectionForm) {
  return snapshot(item) !== baseline.value[item.id]
}

function chosen(id: string): 'save' | 'apply' {
  return choice[id] ?? 'save'
}

function choiceText(item: CollectionForm) {
  if (choice[item.id] === 'apply') {
    return 'В форме есть правки. Они не сохранятся. На сайт попадёт черновик.'
  }
  if (dirty(item)) {
    return 'Сохранение запишет правки формы и удалит черновик. Применение запишет черновик и не сохранит правки формы.'
  }
  return 'Сохранение оставит живую страницу и удалит черновик. Применение запишет черновик на сайт.'
}

function failure(error: unknown, fallback: string) {
  const data = (error as FetchError<{ statusMessage?: string }>)?.data
  return data?.statusMessage || fallback
}

function payload(item: CollectionForm, discard: boolean) {
  const body: Record<string, unknown> = {
    title: item.title,
    slug: item.slug,
    summary: item.summary,
    publicationStatus: item.publicationStatus,
    seoTitle: item.seoTitle,
    seoDescription: item.seoDescription,
    ogImage: item.ogImage,
    noindex: item.noindex,
    modules: item.modules,
  }
  if (!hasModules(item)) {
    body.body = item.body
  }
  if (discard) {
    body.pendingDraft = 'discard'
  }
  return body
}

async function reload() {
  items.value = await requestFetch('/api/admin/collections')
  remember()
}

async function save(item: CollectionForm) {
  if (busyId.value) {
    return
  }
  if (item.pending) {
    choice[item.id] = 'save'
    await nextTick()
    document.getElementById(`collection-draft-choice-${item.id}`)?.scrollIntoView({ block: 'nearest' })
    return
  }
  await persist(item, false)
}

async function saveAndDiscard(item: CollectionForm) {
  await persist(item, true)
}

async function persist(item: CollectionForm, discard: boolean) {
  if (busyId.value) {
    return
  }
  busyId.value = item.id
  message[item.id] = ''
  try {
    await requestFetch(`/api/admin/collections/${item.id}`, { method: 'PATCH', body: payload(item, discard) })
    choice[item.id] = undefined
    if (discard) {
      item.pending = null
    }
    baseline.value[item.id] = snapshot(item)
    message[item.id] = discard ? 'Сохранено, черновик отброшен' : 'Сохранено'
  } catch (error) {
    message[item.id] = failure(error, 'Не сохранилось')
  } finally {
    busyId.value = ''
  }
}

function onApply(item: CollectionForm) {
  if (dirty(item)) {
    choice[item.id] = 'apply'
    nextTick(() => document.getElementById(`collection-draft-choice-${item.id}`)?.scrollIntoView({ block: 'nearest' }))
    return
  }
  void confirmApply(item)
}

async function confirmApply(item: CollectionForm) {
  if (busyId.value) {
    return
  }
  busyId.value = item.id
  message[item.id] = ''
  try {
    await requestFetch(`/api/admin/collections/${item.id}/draft`, { method: 'POST', body: { action: 'apply' } })
    choice[item.id] = undefined
    await reload()
    message[item.id] = 'Черновик опубликован'
  } catch (error) {
    message[item.id] = failure(error, 'Черновик не опубликован')
  } finally {
    busyId.value = ''
  }
}

async function onDiscard(item: CollectionForm) {
  if (busyId.value) {
    return
  }
  busyId.value = item.id
  message[item.id] = ''
  try {
    await requestFetch(`/api/admin/collections/${item.id}/draft`, { method: 'POST', body: { action: 'discard' } })
    item.pending = null
    choice[item.id] = undefined
    message[item.id] = 'Черновик отброшен'
  } catch (error) {
    message[item.id] = failure(error, 'Черновик не отброшен')
  } finally {
    busyId.value = ''
  }
}
</script>

<style scoped>
.admin {
  max-width: 46rem;
  margin: 0 auto;
  padding: 1.5rem;
}
form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-top: 1px solid var(--color-line);
  padding: 1rem 0;
}
</style>
