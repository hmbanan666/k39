<template>
  <section class="practical">
    <h2>Билеты{{ subjectType === 'route' ? '' : ' и события' }}</h2>
    <p class="live-note">
      Строки билетов и события сохраняются отдельно от формы и сразу видны на опубликованной странице.
      Сумма и дата берутся только с официального сайта.
    </p>

    <h3>Билеты</h3>
    <p
      v-if="!tickets.length"
      class="muted"
    >
      Строк нет. {{ subjectType === 'place' ? 'На странице показывается поле «Цена».' : 'Блока «Билеты» на странице нет.' }}
    </p>
    <fieldset
      v-for="(row, index) in tickets"
      :key="index"
      class="row"
    >
      <legend>
        {{ row.slot || `Строка ${index + 1}` }}
        <span
          v-if="row.slot && !shownSlots.includes(row.slot)"
          class="stale"
        >не показывается: проверка старше года или не сохранена</span>
      </legend>
      <div class="grid">
        <UiField label="Слот (латиница)">
          <UiInput
            v-model="row.slot"
            placeholder="adult"
            required
          />
        </UiField>
        <UiField label="Кто">
          <UiSelect
            v-model="row.audience"
            :options="audienceOptions"
          />
        </UiField>
        <UiField label="Цена, ₽ (0 для бесплатного)">
          <UiInput
            v-model="row.priceRub"
            type="number"
          />
        </UiField>
        <UiField label="Название (необязательно)">
          <UiInput v-model="row.label" />
        </UiField>
      </div>
      <UiField label="Условие">
        <UiInput
          v-model="row.condition"
          placeholder="Школьники, студенты очной формы, пенсионеры"
        />
      </UiField>
      <div class="grid">
        <UiField label="Источник: ссылка на официальный сайт">
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
        @click="tickets.splice(index, 1)"
      >
        Убрать строку
      </UiButton>
    </fieldset>
    <div class="actions">
      <UiButton
        variant="line"
        :disabled="tickets.length >= ADMISSION_MAX_ROWS"
        @click="addTicket"
      >
        Добавить строку
      </UiButton>
      <UiButton
        :disabled="busy"
        @click="saveTickets"
      >
        Сохранить билеты
      </UiButton>
    </div>

    <template v-if="subjectType !== 'route'">
      <h3>События</h3>
      <ul
        v-if="events.length"
        class="events"
      >
        <li
          v-for="item in events"
          :key="item.id"
          :class="{ off: !item.shown }"
        >
          <span>{{ eventWhen(item) }}: {{ item.title }}</span>
          <span
            v-if="item.cancelledAt"
            class="muted"
          >отменено</span>
          <span
            v-else-if="!item.shown"
            class="muted"
          >прошло</span>
          <template v-else>
            <UiButton
              variant="quiet"
              @click="editEvent(item)"
            >
              Изменить
            </UiButton>
            <UiButton
              variant="quiet"
              :disabled="busy"
              @click="cancelEvent(item.id)"
            >
              Отменить
            </UiButton>
          </template>
        </li>
      </ul>
      <p
        v-else
        class="muted"
      >
        Событий нет.
      </p>
      <fieldset class="row">
        <legend>{{ draft.id ? 'Изменить событие' : 'Новое событие' }}</legend>
        <UiField label="Название">
          <UiInput v-model="draft.title" />
        </UiField>
        <UiSwitch
          v-model="draft.allDay"
          label="Только дата, без времени"
        />
        <div
          v-if="draft.allDay"
          class="grid"
        >
          <UiField label="С">
            <UiInput
              v-model="draft.startsOn"
              type="date"
            />
          </UiField>
          <UiField label="По (необязательно)">
            <UiInput
              v-model="draft.endsOn"
              type="date"
            />
          </UiField>
        </div>
        <div
          v-else
          class="grid"
        >
          <UiField label="Начало (Калининград)">
            <UiInput
              v-model="draft.startsAt"
              type="datetime-local"
            />
          </UiField>
          <UiField label="Конец (необязательно)">
            <UiInput
              v-model="draft.endsAt"
              type="datetime-local"
            />
          </UiField>
        </div>
        <UiField label="Билеты: ссылка, на которую ведёт официальная страница">
          <UiInput
            v-model="draft.ticketUrl"
            type="url"
          />
        </UiField>
        <div class="grid">
          <UiField label="Источник: ссылка">
            <UiInput
              v-model="draft.sourceUrl"
              type="url"
            />
          </UiField>
          <UiField label="Источник: название">
            <UiInput v-model="draft.sourceTitle" />
          </UiField>
          <UiField label="Проверено">
            <UiInput
              v-model="draft.checkedAt"
              type="date"
            />
          </UiField>
        </div>
        <div class="actions">
          <UiButton
            v-if="draft.id"
            variant="quiet"
            @click="resetDraft"
          >
            Новое вместо изменения
          </UiButton>
          <UiButton
            :disabled="busy"
            @click="saveEvent"
          >
            Сохранить событие
          </UiButton>
        </div>
      </fieldset>
    </template>
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
import type { AdmissionAudience } from '~~/shared/admission'
import type { EventTiming } from '~~/shared/events'
import { ADMISSION_AUDIENCES, ADMISSION_LABELS, ADMISSION_MAX_ROWS } from '~~/shared/admission'
import { eventWhen } from '~~/shared/events'
import { localNow } from '~~/shared/schedule'

interface TicketRow {
  slot: string
  audience: AdmissionAudience
  priceRub: string | number
  condition: string
  label: string
  sourceUrl: string
  sourceTitle: string
  checkedAt: string
}
interface AdminEvent {
  id: string
  title: string
  startsAt: string
  endsAt: string | null
  allDay: boolean
  ticketUrl: string | null
  sourceUrl: string
  sourceTitle: string
  checkedAt: string
  cancelledAt: string | null
  local: EventTiming
  shown: boolean
}
interface PracticalData {
  admission: Array<Omit<TicketRow, 'condition' | 'label' | 'priceRub'> & { priceRub: number, condition: string | null, label: string | null }>
  shownSlots: string[]
  events: AdminEvent[]
}

const props = defineProps<{ subjectType: 'place' | 'venue' | 'route', subjectId: string }>()
const requestFetch = useRequestFetch()
const base = `/api/admin/practical/${props.subjectType}/${props.subjectId}`
const audienceOptions = ADMISSION_AUDIENCES.map((value) => ({ value, label: ADMISSION_LABELS[value] }))
const today = () => localNow(new Date()).date

const tickets = ref<TicketRow[]>([])
const shownSlots = ref<string[]>([])
const events = ref<AdminEvent[]>([])
const busy = ref(false)
const message = ref('')
function emptyDraft() {
  return {
    id: '',
    title: '',
    allDay: false,
    startsAt: '',
    endsAt: '',
    startsOn: '',
    endsOn: '',
    ticketUrl: '',
    sourceUrl: '',
    sourceTitle: '',
    checkedAt: today(),
  }
}
const draft = reactive(emptyDraft())

function fill(data: PracticalData) {
  tickets.value = data.admission.map((row) => ({
    ...row,
    condition: row.condition || '',
    label: row.label || '',
  }))
  shownSlots.value = data.shownSlots
  events.value = data.events
}
fill(await requestFetch<PracticalData>(base))

async function reload() {
  fill(await $fetch<PracticalData>(base))
}

function failure(error: unknown, fallback: string) {
  const data = (error as FetchError<{ statusMessage?: string }>)?.data
  return data?.statusMessage || fallback
}

function addTicket() {
  tickets.value.push({ slot: '', audience: 'general', priceRub: '', condition: '', label: '', sourceUrl: '', sourceTitle: '', checkedAt: today() })
}

async function saveTickets() {
  busy.value = true
  message.value = ''
  try {
    const rows = tickets.value.map((row, index) => ({
      slot: row.slot.trim(),
      audience: row.audience,
      priceRub: Number(row.priceRub),
      condition: row.condition.trim() || null,
      label: row.label.trim() || null,
      sourceUrl: row.sourceUrl.trim(),
      sourceTitle: row.sourceTitle.trim(),
      checkedAt: row.checkedAt,
      sortOrder: index,
    }))
    const saved = await $fetch<{ writingWarnings: string[] }>(`${base}/admission`, { method: 'PUT', body: { rows } })
    await reload()
    message.value = saved.writingWarnings.length ? `Билеты сохранены. Замечания: ${saved.writingWarnings.join('; ')}` : 'Билеты сохранены'
  } catch (error) {
    message.value = failure(error, 'Билеты не сохранились')
  } finally {
    busy.value = false
  }
}

function resetDraft() {
  Object.assign(draft, emptyDraft())
}

function editEvent(item: AdminEvent) {
  Object.assign(draft, {
    id: item.id,
    title: item.title,
    allDay: item.allDay,
    startsAt: item.local.startsAt || '',
    endsAt: item.local.endsAt || '',
    startsOn: item.local.startsOn || '',
    endsOn: item.local.endsOn || '',
    ticketUrl: item.ticketUrl || '',
    sourceUrl: item.sourceUrl,
    sourceTitle: item.sourceTitle,
    checkedAt: today(),
  })
}

async function saveEvent() {
  busy.value = true
  message.value = ''
  try {
    await $fetch(`${base}/events`, {
      method: 'POST',
      body: {
        id: draft.id || undefined,
        event: {
          title: draft.title,
          allDay: draft.allDay,
          startsAt: draft.allDay ? null : draft.startsAt || null,
          endsAt: draft.allDay ? null : draft.endsAt || null,
          startsOn: draft.allDay ? draft.startsOn || null : null,
          endsOn: draft.allDay ? draft.endsOn || null : null,
          ticketUrl: draft.ticketUrl.trim() || null,
          sourceUrl: draft.sourceUrl.trim(),
          sourceTitle: draft.sourceTitle.trim(),
          checkedAt: draft.checkedAt,
        },
      },
    })
    resetDraft()
    await reload()
    message.value = 'Событие сохранено'
  } catch (error) {
    message.value = failure(error, 'Событие не сохранилось')
  } finally {
    busy.value = false
  }
}

async function cancelEvent(id: string) {
  busy.value = true
  message.value = ''
  try {
    await $fetch(`${base}/events`, { method: 'POST', body: { id, remove: true } })
    await reload()
    message.value = 'Событие отменено'
  } catch (error) {
    message.value = failure(error, 'Событие не отменилось')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.practical { display: flex; flex-direction: column; gap: 0.7rem; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e6d5b0; }
.practical h2, .practical h3 { margin: 0.4rem 0 0; }
.live-note { margin: 0; padding: 0.6rem 0.8rem; border-left: 3px solid var(--color-brick); background: var(--color-surface); }
.muted { color: var(--muted); }
.row { display: flex; flex-direction: column; gap: 0.5rem; margin: 0; padding: 0.7rem 0.8rem; border: 1px solid #e6d5b0; border-radius: 8px; }
.row legend { padding: 0 0.3rem; font-weight: 600; }
.stale { margin-left: 0.5rem; color: #9b3d2a; font-weight: 400; font-size: 0.88rem; }
.grid { display: grid; gap: 0.5rem; }
.actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.events { margin: 0; padding: 0; list-style: none; }
.events li { display: flex; flex-wrap: wrap; gap: 0.3rem 0.8rem; align-items: center; padding: 0.4rem 0; border-top: 1px solid #e6d5b0; }
.events li.off { color: var(--muted); }
@media (min-width: 640px) {
  .grid { grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); }
}
</style>
