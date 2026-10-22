<template>
  <section class="notices">
    <h2>Объявления на даты</h2>
    <p class="live-note">
      Переезд на другой адрес, закрытие или реконструкция с точными датами. Строки сохраняются отдельно от формы и сразу видны на странице.
      Расписание, адрес и точка на карте не меняются. Строка скрывается сама на следующий день после даты «по».
    </p>
    <AdminPlaceDraftNotice
      v-if="pending"
      :pending="pending"
      :busy="busy"
      heading-id="notices-draft-title"
      @apply="decide('apply')"
      @discard="decide('discard')"
    />
    <p
      v-else-if="hasDraft"
      class="muted"
    >
      У страницы есть черновик. Его объявления показаны в блоке черновика выше. Сохранение здесь сначала спросит, отбросить ли черновик.
    </p>
    <p
      v-if="!rows.length"
      class="muted"
    >
      Объявлений нет.
    </p>
    <fieldset
      v-for="(row, index) in rows"
      :key="row.key"
      class="row"
    >
      <legend>
        {{ NOTICE_KIND_TITLE[row.kind] }}
        <span
          v-if="row.state"
          class="state"
          :class="`state-${row.state}`"
        >{{ STATE_LABEL[row.state] }}</span>
        <span
          v-if="row.needsCheck"
          class="state state-check"
        >пора перепроверить</span>
      </legend>
      <div class="grid">
        <UiField label="Что">
          <UiSelect
            v-model="row.kind"
            :options="kindOptions"
          />
        </UiField>
        <UiField label="С">
          <UiInput
            v-model="row.from"
            type="date"
            required
          />
        </UiField>
        <UiField label="По, включительно">
          <UiInput
            v-model="row.to"
            type="date"
          />
        </UiField>
      </div>
      <UiField
        v-if="!row.to"
        label="Почему нет даты «по» (не показывается)"
      >
        <UiInput
          v-model="row.openEndedReason"
          placeholder="На официальной странице нет даты окончания"
        />
      </UiField>
      <UiField :label="`Текст, до ${NOTICE_TEXT_MAX} символов. Даты печатаются сами`">
        <UiTextarea
          v-model="row.text"
          :rows="2"
        />
      </UiField>
      <UiField
        v-if="row.kind === 'relocation'"
        label="Временный адрес, как в источнике"
      >
        <UiInput v-model="row.address" />
      </UiField>
      <div class="grid">
        <UiField label="Источник: официальная ссылка">
          <UiInput
            v-model="row.sourceUrl"
            type="url"
          />
        </UiField>
        <UiField label="Источник: название">
          <UiInput v-model="row.sourceTitle" />
        </UiField>
        <UiField label="Проверено">
          <UiInput
            v-model="row.checkedAt"
            type="date"
          />
        </UiField>
      </div>
      <UiButton
        variant="quiet"
        @click="rows.splice(index, 1)"
      >
        Убрать строку
      </UiButton>
    </fieldset>
    <div class="actions">
      <UiButton
        variant="line"
        :disabled="rows.length >= NOTICE_MAX"
        @click="addRow"
      >
        Добавить объявление
      </UiButton>
      <UiButton
        :disabled="busy"
        @click="save()"
      >
        Сохранить объявления
      </UiButton>
      <UiButton
        v-if="blockedByDraft"
        variant="amber"
        :disabled="busy"
        @click="save('discard')"
      >
        Отбросить черновик и сохранить
      </UiButton>
    </div>
    <p
      v-if="message"
      aria-live="polite"
    >
      {{ message }}
    </p>
  </section>
</template>

<script setup lang="ts">
import type { FetchError } from 'ofetch'
import type { NoticeKind, NoticeSubjectType } from '~~/shared/notices'
import type { PlaceDraftNotice } from '~~/shared/place-draft-diff'
import { NOTICE_KIND_TITLE, NOTICE_KINDS, NOTICE_MAX, NOTICE_TEXT_MAX, noticeToday } from '~~/shared/notices'

type RowState = 'current' | 'upcoming' | 'expired'
interface StoredNotice {
  id: string
  kind: NoticeKind
  from: string
  to: string | null
  openEndedReason: string | null
  text: string
  address: string | null
  sourceUrl: string
  sourceTitle: string
  checkedAt: string
  state: RowState
  needsCheck: boolean
}
interface NoticesData {
  notices: StoredNotice[]
  hasDraft: boolean
  pending: PlaceDraftNotice | null
}
interface EditRow {
  key: string
  id?: string
  kind: NoticeKind
  from: string
  to: string
  openEndedReason: string
  text: string
  address: string
  sourceUrl: string
  sourceTitle: string
  checkedAt: string
  state?: RowState
  needsCheck?: boolean
}

const props = defineProps<{ subjectType: NoticeSubjectType, subjectId: string }>()
const requestFetch = useRequestFetch()
const base = `/api/admin/notices/${props.subjectType}/${props.subjectId}`
const kindOptions = NOTICE_KINDS.map((value) => ({ value, label: NOTICE_KIND_TITLE[value] }))
const STATE_LABEL: Record<RowState, string> = {
  current: 'идёт',
  upcoming: 'впереди',
  expired: 'прошло, не показывается',
}
const today = () => noticeToday(new Date())

const rows = ref<EditRow[]>([])
const hasDraft = ref(false)
const pending = ref<PlaceDraftNotice | null>(null)
const blockedByDraft = ref(false)
const busy = ref(false)
const message = ref('')
let counter = 0

function fill(data: NoticesData) {
  rows.value = data.notices.map((row) => ({
    ...row,
    key: row.id,
    to: row.to || '',
    openEndedReason: row.openEndedReason || '',
    address: row.address || '',
  }))
  hasDraft.value = data.hasDraft
  pending.value = data.pending
  blockedByDraft.value = false
}
fill(await requestFetch<NoticesData>(base))

async function reload() {
  fill(await $fetch<NoticesData>(base))
}

function failure(error: unknown, fallback: string) {
  const data = (error as FetchError<{ statusMessage?: string }>)?.data
  return data?.statusMessage || fallback
}

function addRow() {
  counter += 1
  rows.value.push({
    key: `new-${counter}`,
    kind: 'relocation',
    from: '',
    to: '',
    openEndedReason: '',
    text: '',
    address: '',
    sourceUrl: '',
    sourceTitle: '',
    checkedAt: today(),
  })
}

async function save(pendingDraft?: 'discard') {
  busy.value = true
  message.value = ''
  try {
    const notices = rows.value.map((row) => ({
      ...(row.id ? { id: row.id } : {}),
      kind: row.kind,
      from: row.from,
      to: row.to || null,
      openEndedReason: row.to ? null : row.openEndedReason.trim() || null,
      text: row.text,
      address: row.kind === 'relocation' ? row.address.trim() || null : null,
      sourceUrl: row.sourceUrl.trim(),
      sourceTitle: row.sourceTitle.trim(),
      checkedAt: row.checkedAt,
    }))
    const saved = await $fetch<{ writingWarnings: string[] }>(base, { method: 'PUT', body: { notices, pendingDraft } })
    await reload()
    message.value = saved.writingWarnings.length
      ? `Объявления сохранены. Замечания: ${saved.writingWarnings.join('; ')}`
      : 'Объявления сохранены'
  } catch (error) {
    blockedByDraft.value = (error as FetchError)?.statusCode === 409 && hasDraft.value
    message.value = failure(error, 'Объявления не сохранились')
  } finally {
    busy.value = false
  }
}

async function decide(action: 'apply' | 'discard') {
  busy.value = true
  message.value = ''
  try {
    await $fetch(`${base}/draft`, { method: 'POST', body: { action, updatedAt: pending.value?.updatedAt } })
    await reload()
    message.value = action === 'apply' ? 'Черновик применён' : 'Черновик отброшен'
  } catch (error) {
    message.value = failure(error, 'Не получилось')
    if ((error as FetchError)?.statusCode === 409) {
      await reload()
    }
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.notices { display: flex; flex-direction: column; gap: 0.7rem; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--color-line); }
.notices h2 { margin: 0.4rem 0 0; }
.live-note { margin: 0; padding: 0.6rem 0.8rem; border-left: 3px solid var(--color-brick); background: var(--color-surface); }
.muted { color: var(--muted); }
.row { display: flex; flex-direction: column; gap: 0.5rem; margin: 0; padding: 0.7rem 0.8rem; border: 1px solid var(--color-line); border-radius: 8px; }
.row legend { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; padding: 0 0.3rem; font-weight: 700; }
.state { padding: 0.05rem 0.5rem; border-radius: 999px; background: var(--color-sea-light); color: var(--color-sea); font-size: 0.8rem; font-weight: 600; }
.state-current { background: var(--color-amber-soft); color: var(--color-partner); }
.state-expired { background: var(--color-sand); color: var(--color-muted); }
.state-check { background: var(--color-amber-soft); color: var(--color-warn); }
.grid { display: grid; gap: 0.5rem; }
.actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
@media (min-width: 720px) {
  .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
</style>
