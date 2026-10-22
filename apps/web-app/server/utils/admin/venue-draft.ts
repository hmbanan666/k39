import type { PlaceDraftChange, PlaceDraftNotice } from '../../../shared/place-draft-diff'
import type { VenuePendingPayload } from '../venues/pending'
import { db } from '@k39/database'
import { createError } from 'h3'
import { noticeSummary } from '../../../shared/notices'
import { formatDraftUpdated } from '../../../shared/place-draft-diff'
import { describeSchedule } from '../../../shared/schedule'
import { withContentScope } from '../access'
import { stagedNotices, toNoticeValue } from '../notices/write'
import { loadSchedule } from '../schedule'
import { applyPendingVenue, pendingVenueWrite } from '../venues/pending'

const LABELS: Record<string, string> = {
  name: 'Название', kind: 'Тип', cuisineTags: 'Кухня', regionSlug: 'Регион',
  address: 'Адрес', phone: 'Телефон', latitude: 'Широта', longitude: 'Долгота',
  priceLevel: 'Уровень цен', avgCheck: 'Средний чек', website: 'Сайт',
  bookingUrl: 'Бронирование', orderUrl: 'Заказ', deliveryUrl: 'Доставка', menuUrl: 'Меню',
  reservation: 'Бронь столика', takeaway: 'Навынос', delivery: 'Есть доставка',
  signatureDishes: 'Блюда', modules: 'Модули', description: 'Описание', sources: 'Источники', lastVerifiedAt: 'Проверено',
}

function text(value: unknown): string {
  if (value == null || value === '') {
    return 'пусто'
  }
  if (typeof value === 'boolean') {
    return value ? 'да' : 'нет'
  }
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
}

export async function venueDraftNotice(id: string): Promise<PlaceDraftNotice | null> {
  const [venue, draft] = await Promise.all([db.venues.byId(id), db.editor.contentDraft('venue', id)])
  if (!venue || !draft) {
    return null
  }
  const payload = draft.payload as VenuePendingPayload
  const write = await pendingVenueWrite(payload.fields ?? {})
  const changes: PlaceDraftChange[] = []
  const add = (field: string, label: string, live: unknown, next: unknown) => {
    if (text(live) !== text(next)) {
      changes.push({ field, label, live: text(live), draft: text(next) })
    }
  }
  for (const [key, value] of Object.entries(payload.fields ?? {})) {
    let live: unknown = venue[key as keyof typeof venue]
    if (key === 'regionSlug') {
      const regions = await db.editor.listRegions()
      live = regions.find((region) => region.id === venue.regionId)?.slug ?? null
    }
    add(key, LABELS[key] ?? key, live, key === 'regionSlug' ? value : write[key as keyof typeof write])
  }
  if (Object.hasOwn(payload, 'schedule')) {
    const live = await loadSchedule('venue', id)
    const lines = (record: typeof live) => record ? [...describeSchedule(record.rules), `Источник: ${record.sourceUrl || 'не указан'}`, `Проверено: ${record.verifiedAt || 'не проверено'}`].join('\n') : 'пусто'
    add('schedule', 'Часы', lines(live), lines(payload.schedule ?? null))
  }
  if (payload.prices) {
    const live = await db.prices.forVenue(id)
    const lines = (rows: Array<{ item: string, variant?: string | null, priceRub: number, checkedAt: string, sourceKind: string, sourceTitle: string, sourceUrl?: string | null }>) => rows.map((row) => `${row.item}${row.variant ? ` (${row.variant})` : ''}: ${row.priceRub} ₽; ${row.checkedAt}; ${row.sourceKind}; ${row.sourceTitle}; ${row.sourceUrl || ''}`).join('\n')
    add('prices', 'Ориентиры цен', lines(live), lines(payload.prices))
  }
  const notices = stagedNotices(payload)
  if (notices) {
    const live = await db.notices.forSubject('venue', id)
    add('notices', 'На эти даты', noticeSummary(live.map(toNoticeValue)), noticeSummary(notices))
  }
  return { updatedAt: draft.updatedAt, updatedLabel: formatDraftUpdated(draft.updatedAt), publicationStatus: 'review', changes }
}

export async function decideVenueDraft(id: string, action: 'apply' | 'discard', updatedAt: unknown) {
  const draft = await db.editor.contentDraft('venue', id)
  if (!draft) {
    throw createError({ statusCode: 409, statusMessage: 'Черновика нет' })
  }
  if (typeof updatedAt !== 'string' || draft.updatedAt !== updatedAt) {
    throw createError({ statusCode: 409, statusMessage: 'Черновик изменился. Обновите страницу.' })
  }
  if (action === 'apply') {
    return withContentScope('editor', () => applyPendingVenue(id, draft))
  }
  return db.venues.withLocked(id, async (tx) => {
    const deleted = await db.editor.deleteContentDraftIfUnchanged(draft.id, draft.updatedAt, tx)
    if (!deleted) {
      throw createError({ statusCode: 409, statusMessage: 'Черновик изменился. Обновите страницу.' })
    }
    return { discarded: true }
  })
}
