import type { FactActor } from '../../../shared/facts'
import type { PracticalTarget } from './target'
import { db } from '@k39/database'
import { createError } from 'h3'
import { z } from 'zod'
import { EVENT_TITLE_MAX, eventFormTiming, eventInstants } from '../../../shared/events'
import { classifyMenuUrl } from '../../../shared/price-compare'
import { commitFact, retireFactSlot } from '../facts/commit'
import { rejectBannedSites } from '../mcp/writing-guard'
import { eventSourceProblem, ticketUrlProblem } from './sources'
import { refuseDraftLivePractical } from './target'

export const eventInput = z.object({
  title: z.string().trim().min(1).max(EVENT_TITLE_MAX),
  allDay: z.boolean().optional(),
  startsAt: z.string().trim().nullable().optional(),
  endsAt: z.string().trim().nullable().optional(),
  startsOn: z.string().trim().nullable().optional(),
  endsOn: z.string().trim().nullable().optional(),
  ticketUrl: z.string().trim().url().nullable().optional(),
  sourceUrl: z.string().trim().url(),
  sourceTitle: z.string().trim().min(1).max(200),
  checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkedAt: YYYY-MM-DD'),
})
export type EventInput = z.infer<typeof eventInput>

function bad(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message })
}

function slotKey(id: string) {
  return `event:${id}`
}

export function normalizeEvent(input: EventInput, now = new Date()) {
  const timing = eventInstants({ allDay: Boolean(input.allDay), startsAt: input.startsAt, endsAt: input.endsAt, startsOn: input.startsOn, endsOn: input.endsOn })
  if (typeof timing === 'string') {
    bad(timing)
  }
  const end = timing.endsAt ?? timing.startsAt
  if (end.getTime() <= now.getTime()) {
    bad('Событие уже прошло')
  }
  const problem = eventSourceProblem(input.sourceUrl) ?? ticketUrlProblem(input.ticketUrl)
  if (problem) {
    bad(problem)
  }
  if (input.checkedAt > now.toISOString().slice(0, 10)) {
    bad('checkedAt — день проверки, не в будущем')
  }
  return {
    title: input.title.trim(),
    startsAt: timing.startsAt.toISOString(),
    endsAt: timing.endsAt?.toISOString() ?? null,
    allDay: Boolean(input.allDay),
    ticketUrl: input.ticketUrl?.trim() || null,
    sourceUrl: input.sourceUrl.trim(),
    sourceTitle: input.sourceTitle.trim(),
    checkedAt: input.checkedAt,
  }
}

async function writeEventFact(target: PracticalTarget, row: { id: string, title: string, startsAt: string, endsAt: string | null, allDay: boolean, ticketUrl: string | null, sourceUrl: string, sourceTitle: string, checkedAt: string }, actor: FactActor) {
  return commitFact({
    kind: 'event',
    subjectType: target.type,
    subjectId: target.id,
    slot: slotKey(row.id),
    value: { title: row.title, start: new Date(row.startsAt).toISOString(), end: row.endsAt ? new Date(row.endsAt).toISOString() : null, ticketUrl: row.ticketUrl, allDay: row.allDay },
    sourceUrl: row.sourceUrl,
    sourceTitle: row.sourceTitle,
    sourceKind: classifyMenuUrl(row.sourceUrl) === 'social' ? 'official_social' : 'official',
    checkedAt: `${row.checkedAt}T00:00:00.000Z`,
    confidence: 'stated',
    actor,
    refs: [{ consumerType: target.type, consumerId: target.id, path: 'upcoming' }],
    pageType: target.type,
    pageStatus: target.status,
  })
}

async function ownedEvent(target: PracticalTarget, id: string) {
  const row = await db.calendarEvents.byId(id)
  if (!row || row.subjectType !== target.type || row.subjectId !== target.id) {
    throw createError({ statusCode: 404, statusMessage: 'Событие не найдено' })
  }
  return row
}

/**
 * Creates or updates one event. `remove` sets `cancelled_at` and retires the fact.
 * The draft token gets 409 on a live parent and nothing is stored.
 */
export async function upsertEvent(target: PracticalTarget, input: { id?: string | null, remove?: boolean, event?: EventInput | null }, actor: FactActor, now = new Date()) {
  if (target.type === 'route') {
    bad('События принадлежат месту или заведению. Маршрут показывает события остановок')
  }
  refuseDraftLivePractical(target, 'events')
  if (input.remove) {
    if (!input.id) {
      bad('Для remove нужен id события')
    }
    await ownedEvent(target, input.id)
    const cancelled = await db.calendarEvents.cancel(input.id, now.toISOString())
    await retireFactSlot(target.type, target.id, slotKey(input.id))
    return { event: cancelled ?? await db.calendarEvents.byId(input.id), removed: true, ownerConflict: null as string | null }
  }
  if (!input.event) {
    bad('Нужны поля события')
  }
  const row = normalizeEvent(input.event, now)
  rejectBannedSites(row)
  let saved
  if (input.id) {
    const current = await ownedEvent(target, input.id)
    if (current.cancelledAt || current.expiredAt) {
      bad('Событие уже отменено или прошло. Создайте новое')
    }
    saved = await db.calendarEvents.update(input.id, row)
  } else {
    saved = await db.calendarEvents.insert({ ...row, subjectType: target.type, subjectId: target.id })
  }
  if (!saved) {
    throw createError({ statusCode: 404, statusMessage: 'Событие не найдено' })
  }
  const fact = await writeEventFact(target, saved, actor)
  return { event: saved, removed: false, ownerConflict: fact.conflict ? fact.queueId : null }
}

/**
 * Nightly expiry. Sets `expired_at` and retires the fact once the end has passed.
 * The public read applies the same comparison, so a missed run shows nothing past.
 */
export async function expireEvents(now = new Date()) {
  const claimed = await db.analytics.claimRun(now.toISOString().slice(0, 10), 'event-expire')
  if (!claimed) {
    return { skipped: true, expired: 0 }
  }
  return { skipped: false, expired: await retirePastEvents(now) }
}

export async function retirePastEvents(now = new Date()) {
  const due = await db.calendarEvents.due(now.toISOString())
  await db.calendarEvents.markExpired(due.map((row) => row.id), now.toISOString())
  for (const row of due) {
    await retireFactSlot(row.subjectType as PracticalTarget['type'], row.subjectId, slotKey(row.id))
  }
  return due.length
}

/** `fact_update` on an event fact rewrites the row through `upsertEvent`. */
export async function updateEventFact(target: PracticalTarget, slot: string, value: { title: string, start: string, end: string | null, ticketUrl: string | null, allDay: boolean }, source: { sourceUrl: string | null, sourceTitle: string | null, checkedAt: string | null }) {
  const id = slot.replace(/^event:/, '')
  const current = await ownedEvent(target, id)
  const timing = eventFormTiming({ startsAt: value.start, endsAt: value.end, allDay: value.allDay })
  return upsertEvent(target, {
    id,
    event: {
      title: value.title,
      ...timing,
      ticketUrl: value.ticketUrl,
      sourceUrl: source.sourceUrl ?? current.sourceUrl,
      sourceTitle: source.sourceTitle ?? current.sourceTitle,
      checkedAt: (source.checkedAt ?? new Date().toISOString()).slice(0, 10),
    },
  }, 'mcp')
}
