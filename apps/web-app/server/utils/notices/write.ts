import type { ContentTx, NoticeRow, NoticeWrite } from '@k39/database'
import type { NoticeSubjectType, NoticeValue } from '../../../shared/notices'
import type { ContentScope } from '../access'
import type { PracticalTarget } from '../practical/target'
import { db, NOTICE_DRAFT_KEYS } from '@k39/database'
import { createError } from 'h3'
import { normalizeNotice, NoticeInputError, noticeListSchema, noticeNeedsCheck, noticeOverlapProblem, noticeState, noticeSummary, noticeToday } from '../../../shared/notices'
import { contentScope } from '../access'
import { writeWithCheckedDraft } from '../content/pending-guard'
import { contentWarnings, savePendingDraftContent } from '../content/save'
import { auditMcp } from '../mcp/audit'
import { rejectBannedSites } from '../mcp/writing-guard'
import { ownOfficialSourceKind } from '../practical/sources'
import { isLivePractical, practicalTarget } from '../practical/target'

export type NoticeTarget = PracticalTarget<NoticeSubjectType>

/** Statuses whose page is public. A notice there passes the publish gate. */
const PUBLIC: Record<NoticeSubjectType, readonly string[]> = {
  place: ['published'],
  venue: ['published', 'closed'],
}

/**
 * A place takes only its own official site. A venue also takes its own VK
 * community from `socials`, the same rule as an event source.
 */
export function noticeSourceProblem(target: Pick<NoticeTarget, 'type' | 'own'>, url: string) {
  if (ownOfficialSourceKind(url, target.own)) {
    return null
  }
  if (target.type === 'venue') {
    return 'Источник объявления: официальный сайт заведения или его собственное сообщество ВКонтакте из «Соцсетей». Карта, OSM, агрегатор и файл на Диске не подходят'
  }
  return 'Источник объявления: только официальный сайт места, музея или администрации. Соцсеть, карта, агрегатор и файл на Диске не подходят'
}

/**
 * Parses, normalizes, and checks a full list for one subject. `known` is
 * the stored ids of that subject: `strict` refuses another id, otherwise it
 * becomes an insert (a staged row whose live row was removed since).
 */
export function prepareNotices(target: NoticeTarget, input: unknown, today: string, known: ReadonlySet<string>, strict: boolean): NoticeValue[] {
  const parsed = noticeListSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const where = issue?.path.length ? `notices.${issue.path.join('.')}: ` : ''
    throw createError({ statusCode: 400, statusMessage: `${where}${issue?.message || 'Проверьте объявления'}` })
  }
  const rows: NoticeValue[] = []
  for (const item of parsed.data) {
    let row: NoticeValue
    try {
      row = normalizeNotice(item, today)
    } catch (error) {
      if (error instanceof NoticeInputError) {
        throw createError({ statusCode: 400, statusMessage: error.message })
      }
      throw error
    }
    if (row.id && !known.has(row.id)) {
      if (strict) {
        throw createError({ statusCode: 400, statusMessage: `Объявление ${row.id} не найдено у этой страницы` })
      }
      delete row.id
    }
    const source = noticeSourceProblem(target, row.sourceUrl)
    if (source) {
      throw createError({ statusCode: 400, statusMessage: source })
    }
    rows.push(row)
  }
  const ids = rows.flatMap((row) => row.id ? [row.id] : [])
  if (new Set(ids).size !== ids.length) {
    throw createError({ statusCode: 400, statusMessage: 'Один id объявления указан дважды' })
  }
  const overlap = noticeOverlapProblem(rows, today)
  if (overlap) {
    throw createError({ statusCode: 400, statusMessage: overlap })
  }
  rejectBannedSites(rows.map((row) => row.sourceUrl))
  return rows
}

/** The stop-list gate over text, address, and the editorial reason. */
function noticeGate(target: NoticeTarget, rows: NoticeValue[], publishing: boolean) {
  return {
    prose: rows.flatMap((row) => [row.text, row.address ?? '', row.openEndedReason ?? '']),
    publishing,
    venue: target.type === 'venue',
  }
}

export function noticeWarnings(target: NoticeTarget, rows: NoticeValue[], publishing: boolean) {
  return contentWarnings(noticeGate(target, rows, publishing))
}

export function toNoticeWrite(row: NoticeValue): NoticeWrite {
  return {
    ...(row.id ? { id: row.id } : {}),
    kind: row.kind,
    startsOn: row.from,
    endsOn: row.to,
    openEndedReason: row.openEndedReason,
    text: row.text,
    address: row.address,
    sourceUrl: row.sourceUrl,
    sourceTitle: row.sourceTitle,
    checkedAt: row.checkedAt,
  }
}

export function toNoticeValue(row: NoticeRow): NoticeValue {
  return {
    id: row.id,
    kind: row.kind,
    from: row.startsOn,
    to: row.endsOn,
    openEndedReason: row.openEndedReason,
    text: row.text,
    address: row.address,
    sourceUrl: row.sourceUrl,
    sourceTitle: row.sourceTitle,
    checkedAt: row.checkedAt,
  }
}

/** A stored row with its window state on `today`, for the tools and the admin list. */
export function storedNotice(row: NoticeRow, today: string) {
  const value = toNoticeValue(row)
  return {
    ...value,
    state: noticeState(value, today),
    expiredAt: row.expiredAt,
    needsCheck: noticeNeedsCheck(value, today),
    updatedAt: row.updatedAt,
  }
}

function isPublicSubject(target: Pick<NoticeTarget, 'type' | 'status'>) {
  return PUBLIC[target.type].includes(target.status)
}

/** The staged list on a `content_drafts` payload, or null when this key was never sent. */
export function stagedNotices(payload: Record<string, unknown> | null | undefined): NoticeValue[] | null {
  if (!payload || !Object.hasOwn(payload, 'notices') || !Array.isArray(payload.notices)) {
    return null
  }
  return payload.notices as NoticeValue[]
}

/** The notices keys of a pending payload, so a later write of other keys keeps them. */
export function stagedNoticeKeys(payload: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => NOTICE_DRAFT_KEYS.includes(key)))
}

/** True when the draft holds only the notices keys, so apply must not touch the page columns. */
export function onlyNoticesStaged(payload: Record<string, unknown>) {
  return Object.keys(payload).every((key) => NOTICE_DRAFT_KEYS.includes(key))
}

export interface SetNoticesInput {
  subjectType: NoticeSubjectType
  id?: string
  slug?: string
  notices: unknown
  /** Admin only: `discard` writes the list and deletes the pending draft that was checked. */
  pendingDraft?: string
}

/**
 * `notices_set` and the admin editor (ADR 0049). Replaces the whole list.
 * The editor writes the live table and drops the whole pending draft in the
 * same transaction. The draft token on a live place or venue stages the list
 * on the existing `content_drafts` payload under `notices`; an archived
 * venue is 409. Neither path writes facts, the address, or the schedule.
 */
export async function setNotices(input: SetNoticesInput, via: 'mcp' | 'admin') {
  const target = await practicalTarget(input.subjectType, input.id, input.slug)
  const scope: ContentScope = via === 'admin' ? 'editor' : contentScope()
  const today = noticeToday(new Date())
  const stored = await db.notices.forSubject(target.type, target.id)
  const known = new Set(stored.map((row) => row.id))
  if (scope === 'draft' && target.type === 'venue' && target.status === 'archived') {
    throw createError({ statusCode: 409, statusMessage: 'Draft token cannot edit notices of an archived venue. The live page was not changed.' })
  }
  const rows = prepareNotices(target, input.notices, today, known, true)
  if (scope === 'draft' && isLivePractical(target)) {
    const stagedAt = new Date().toISOString()
    const store = async (tx?: ContentTx) => {
      const pending = await db.editor.contentDraft(target.type, target.id, tx)
      return savePendingDraftContent({
        entityType: target.type,
        entityId: target.id,
        publicationStatus: pending?.publicationStatus ?? 'review',
        payload: { ...(pending?.payload ?? {}), notices: rows, noticesStagedAt: stagedAt },
      }, noticeGate(target, rows, false), tx)
    }
    const { row: saved, writingWarnings } = target.type === 'venue'
      ? await db.venues.withLocked(target.id, (tx, venue) => {
          if (venue.status !== 'published' && venue.status !== 'closed') {
            throw createError({ statusCode: 409, statusMessage: 'Статус заведения изменился. Живая карточка не изменилась.' })
          }
          return store(tx)
        })
      : await store()
    if (via === 'mcp') {
      await auditMcp('notices_set', target.type, target.id)
    }
    return {
      subjectType: target.type,
      id: target.id,
      slug: target.slug,
      status: target.status,
      pendingReview: true as const,
      notices: stagedNotices(saved.payload) ?? rows,
      noticesStagedAt: stagedAt,
      writingWarnings,
    }
  }
  const writingWarnings = noticeWarnings(target, rows, isPublicSubject(target))
  const write = (tx: ContentTx) => db.notices.replace(target.type, target.id, rows.map(toNoticeWrite), tx)
  const apply = (tx?: ContentTx) => writeWithCheckedDraft(target.type, target.id, via === 'admin' ? { pendingDraft: input.pendingDraft } : 'editor', write, tx)
  const { result: saved, draftDropped } = scope === 'editor'
    ? target.type === 'venue' ? await db.venues.withLocked(target.id, (tx) => apply(tx)) : await apply()
    : { result: await db.editor.transaction(write), draftDropped: false }
  if (via === 'mcp') {
    await auditMcp('notices_set', target.type, target.id)
  }
  return {
    subjectType: target.type,
    id: target.id,
    slug: target.slug,
    status: target.status,
    pendingReview: false as const,
    notices: saved.map((row) => storedNotice(row, today)),
    writingWarnings,
    draftDropped,
  }
}

/**
 * Writes the staged `notices` key of a pending draft through the same
 * checks, with the publish gate. Used by `content_set_publication` when the
 * draft has nothing else for the page columns. Status is not changed.
 */
export async function applyStagedNotices(target: NoticeTarget, pending: { id: string, updatedAt: string, payload: Record<string, unknown> }) {
  const rows = await stagedForApply(target, pending.payload)
  if (!rows) {
    return null
  }
  const saved = await db.notices.applyStaged(target.type, target.id, { id: pending.id, updatedAt: pending.updatedAt }, rows.map(toNoticeWrite))
  if (!saved) {
    throw createError({ statusCode: 409, statusMessage: 'Черновик изменился. Обновите страницу.' })
  }
  return saved
}

/** Re-checks a staged list for apply. Null when the draft has no `notices` key. */
export async function stagedForApply(target: NoticeTarget, payload: Record<string, unknown>) {
  const staged = stagedNotices(payload)
  if (!staged) {
    return null
  }
  const today = noticeToday(new Date())
  const known = new Set((await db.notices.forSubject(target.type, target.id)).map((row) => row.id))
  const rows = prepareNotices(target, staged, today, known, false)
  noticeWarnings(target, rows, isPublicSubject(target))
  return rows
}

/**
 * The live list with each row's window state, plus the staged list when a
 * pending draft has the `notices` key. Shared by `notices_get`, `place_get`,
 * `venue_get`, and the admin editor.
 */
export async function noticesView(target: Pick<NoticeTarget, 'type' | 'id'>, now = new Date()) {
  const today = noticeToday(now)
  const [rows, pending] = await Promise.all([
    db.notices.forSubject(target.type, target.id),
    db.editor.contentDraft(target.type, target.id),
  ])
  const staged = stagedNotices(pending?.payload)
  return {
    notices: rows.map((row) => storedNotice(row, today)),
    pendingReview: pending && staged
      ? {
          id: pending.id,
          updatedAt: pending.updatedAt,
          noticesStagedAt: typeof pending.payload.noticesStagedAt === 'string' ? pending.payload.noticesStagedAt : null,
          notices: staged.map((row) => ({ ...row, state: noticeState(row, today) })),
        }
      : null,
  }
}

/**
 * The «Объявления на даты» row of the admin live-beside-draft diff. Empty
 * when the draft has no `notices` key or the staged list reads the same.
 */
export async function noticeDraftChange(target: Pick<NoticeTarget, 'type' | 'id'>, payload: Record<string, unknown>) {
  const staged = stagedNotices(payload)
  if (!staged) {
    return []
  }
  const live = noticeSummary((await db.notices.forSubject(target.type, target.id)).map(toNoticeValue))
  const draft = noticeSummary(staged)
  return live === draft ? [] : [{ field: 'notices', label: 'Объявления на даты', live, draft }]
}
