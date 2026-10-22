import type { Availability, ScheduleRules } from './schedule'
import { z } from 'zod'
import { russianDay } from './place-guide'
import { availabilityText, localNow, statusFromRules } from './schedule'

// Dated temporary notices on a place or a venue (ADR 0049). One row is one
// dated statement. It is not a fact and not a schedule: the page compares
// the dates with today in Europe/Kaliningrad and drops the row after `to`.

export const NOTICE_KINDS = ['relocation', 'closed', 'renovation', 'other'] as const
export type NoticeKind = (typeof NOTICE_KINDS)[number]
export const NOTICE_SUBJECT_TYPES = ['place', 'venue'] as const
export type NoticeSubjectType = (typeof NOTICE_SUBJECT_TYPES)[number]

export const NOTICE_MAX = 4
export const NOTICE_TEXT_MAX = 160
export const NOTICE_ADDRESS_MAX = 200
export const NOTICE_REASON_MAX = 200
export const NOTICE_SOURCE_TITLE_MAX = 160
/** An open-ended row checked longer ago than this is `needsCheck` in `notices_list`. */
export const NOTICE_RECHECK_DAYS = 30

/** Chrome, not stored text. `other` has no label. */
export const NOTICE_KIND_LABEL: Record<NoticeKind, string> = {
  closed: 'Закрыто',
  renovation: 'Реконструкция',
  relocation: 'Другой адрес',
  other: '',
}

/** Admin and MCP names for each kind. */
export const NOTICE_KIND_TITLE: Record<NoticeKind, string> = {
  relocation: 'Другой адрес',
  closed: 'Закрыто',
  renovation: 'Реконструкция',
  other: 'Другое',
}

const KIND_ORDER: NoticeKind[] = ['closed', 'renovation', 'relocation', 'other']

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isCalendarDate(value: string) {
  if (!ISO_DATE.test(value)) {
    return false
  }
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

const calendarDate = z.string().trim().refine(isCalendarDate, 'Дата в виде ГГГГ-ММ-ДД')

function squash(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

const optionalText = (max: number, label: string) => z.string()
  .transform(squash)
  .pipe(z.string().max(max, `${label}: не больше ${max} символов`))
  .nullable()
  .optional()

/** One row as `notices_set` and the admin editor send it. `id` keeps a stored row. */
export const noticeInputSchema = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  kind: z.enum(NOTICE_KINDS),
  from: calendarDate.describe('First day, YYYY-MM-DD.'),
  to: calendarDate.nullable().optional().describe('Last day the statement is still true, inclusive, YYYY-MM-DD. For an opening on day D, send D minus one. Null only with openEndedReason.'),
  openEndedReason: optionalText(NOTICE_REASON_MAX, 'Почему нет даты окончания').describe('Required when to is null, forbidden when to is set. What the source withheld. Not rendered.'),
  text: z.string().transform(squash).pipe(z.string().min(1, 'Нужен текст объявления').max(NOTICE_TEXT_MAX, `Текст: не больше ${NOTICE_TEXT_MAX} символов`)).describe('Russian, 1 to 160 characters. The page prints the dates before it, so no relative words, no clock, no price.'),
  address: optionalText(NOTICE_ADDRESS_MAX, 'Адрес').describe('Required for relocation, forbidden otherwise. The words the source uses.'),
  sourceUrl: z.string().trim().url('Источник: нужна ссылка http(s)'),
  sourceTitle: z.string().transform(squash).pipe(z.string().min(1, 'Нужно название источника').max(NOTICE_SOURCE_TITLE_MAX, `Название источника: не больше ${NOTICE_SOURCE_TITLE_MAX} символов`)),
  checkedAt: calendarDate.describe('The day the source was opened, YYYY-MM-DD. Not later than today in Kaliningrad.'),
})

export const noticeListSchema = z.array(noticeInputSchema).max(NOTICE_MAX, `Не больше ${NOTICE_MAX} объявлений на странице`)

export type NoticeInput = z.input<typeof noticeInputSchema>

/** A validated row in the API shape. Also the shape staged on `content_drafts`. */
export interface NoticeValue {
  id?: string
  kind: NoticeKind
  from: string
  to: string | null
  openEndedReason: string | null
  text: string
  address: string | null
  sourceUrl: string
  sourceTitle: string
  checkedAt: string
}

/** What the status line needs. The chip and the card re-check it in the browser. */
export interface NoticeWindow {
  kind: NoticeKind
  from: string
  to: string | null
}

/** A row the public page shows. */
export interface PublicNotice extends NoticeWindow {
  state: 'current' | 'upcoming'
  text: string
  address: string | null
  sourceUrl: string
  sourceTitle: string
}

const RELATIVE_WORDS = ['пока', 'сейчас', 'скоро', 'временно', 'сегодня', 'завтра', 'вчера', 'на\\s+днях']
const RELATIVE = new RegExp(`(?<![\\p{L}\\p{N}])(?:${RELATIVE_WORDS.join('|')})(?![\\p{L}\\p{N}])`, 'iu')
const CLOCK = /(?<!\d)\d{1,2}:\d{2}(?!\d)/
const RUBLE = /₽|(?<!\p{L})руб(?:л\p{L}*|\.|(?!\p{L}))/iu

/** Why `text` or `address` cannot be stored, or null. Dates and years are allowed. */
export function noticeTextProblem(value: string, label: string) {
  const relative = RELATIVE.exec(value)
  if (relative) {
    return `${label}: слово «${relative[0].toLowerCase()}» не подходит, даты на странице печатаются сами`
  }
  if (CLOCK.test(value)) {
    return `${label}: время работы хранится в расписании, не в объявлении`
  }
  if (RUBLE.test(value)) {
    return `${label}: цены хранятся в строках цен, не в объявлении`
  }
  return null
}

/** Normalizes one parsed row and checks the rules zod cannot express alone. */
export function normalizeNotice(row: z.output<typeof noticeInputSchema>, today: string): NoticeValue {
  const to = row.to ?? null
  const reason = row.openEndedReason || null
  const address = row.address || null
  const problems: string[] = []
  if (to && to < row.from) {
    problems.push('Дата «по» раньше даты «с»')
  }
  if (!to && !reason) {
    problems.push('Без даты «по» нужна причина: что источник не сообщил')
  }
  if (to && reason) {
    problems.push('Причина без даты окончания не нужна, когда дата «по» указана')
  }
  if (row.kind === 'relocation' && !address) {
    problems.push('Для переезда нужен временный адрес')
  }
  if (row.kind !== 'relocation' && address) {
    problems.push('Адрес указывается только для переезда')
  }
  if (row.checkedAt > today) {
    problems.push('Дата проверки позже сегодняшней')
  }
  const text = noticeTextProblem(row.text, 'Текст')
  if (text) {
    problems.push(text)
  }
  const where = address ? noticeTextProblem(address, 'Адрес') : null
  if (where) {
    problems.push(where)
  }
  if (problems.length) {
    throw new NoticeInputError(problems[0]!)
  }
  return {
    ...(row.id ? { id: row.id } : {}),
    kind: row.kind,
    from: row.from,
    to,
    openEndedReason: to ? null : reason,
    text: row.text,
    address,
    sourceUrl: row.sourceUrl,
    sourceTitle: row.sourceTitle,
    checkedAt: row.checkedAt,
  }
}

export class NoticeInputError extends Error {}

function overlaps(left: NoticeWindow, right: NoticeWindow) {
  const leftEnd = left.to ?? '9999-12-31'
  const rightEnd = right.to ?? '9999-12-31'
  return left.from <= rightEnd && right.from <= leftEnd
}

/**
 * Overlap rules on the list after replace. `closed` and `renovation` cannot
 * overlap, and two rows of one kind cannot. A row that ended before `today`
 * takes no part, so keeping an expired row does not block the next window.
 */
export function noticeOverlapProblem(rows: NoticeWindow[], today: string) {
  const live = rows.filter((row) => !row.to || row.to >= today)
  for (let left = 0; left < live.length; left++) {
    for (let right = left + 1; right < live.length; right++) {
      const a = live[left]!
      const b = live[right]!
      if (!overlaps(a, b)) {
        continue
      }
      if (a.kind === b.kind) {
        return `Два объявления «${NOTICE_KIND_TITLE[a.kind]}» пересекаются по датам`
      }
      const pair = new Set([a.kind, b.kind])
      if (pair.has('closed') && pair.has('renovation')) {
        return '«Закрыто» и «Реконструкция» не могут пересекаться по датам'
      }
    }
  }
  return null
}

/** Today's calendar date in Europe/Kaliningrad, the zone of schedule rules. */
export function noticeToday(at: Date) {
  return localNow(at).date
}

export function noticeState(row: NoticeWindow, today: string): 'upcoming' | 'current' | 'expired' {
  if (today < row.from) {
    return 'upcoming'
  }
  if (row.to && today > row.to) {
    return 'expired'
  }
  return 'current'
}

/** «с 1 ноября 2026 по 13 ноября 2026», or «с 1 ноября 2026» with no end. */
export function noticeDateLine(row: Pick<NoticeWindow, 'from' | 'to'>) {
  const from = `с ${russianDay(row.from)}`
  return row.to ? `${from} по ${russianDay(row.to)}` : from
}

/**
 * The rows a page shows on `today`: current ones first, then upcoming ones.
 * Inside each group: closed, renovation, relocation, other, then `from`.
 */
export function visibleNotices<T extends NoticeWindow & { text: string, address: string | null, sourceUrl: string, sourceTitle: string }>(rows: T[], today: string): PublicNotice[] {
  const shown = rows.flatMap((row) => {
    const state = noticeState(row, today)
    if (state === 'expired') {
      return []
    }
    return [{
      kind: row.kind,
      from: row.from,
      to: row.to,
      state,
      text: row.text,
      address: row.address,
      sourceUrl: row.sourceUrl,
      sourceTitle: row.sourceTitle,
    } satisfies PublicNotice]
  })
  return shown.sort((left, right) => {
    if (left.state !== right.state) {
      return left.state === 'current' ? -1 : 1
    }
    const kind = KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind)
    return kind || left.from.localeCompare(right.from)
  })
}

/** The one line builder for the hero banner and «Коротко». */
export function noticeLines(notice: Pick<PublicNotice, 'kind' | 'from' | 'to' | 'text' | 'address'>) {
  return {
    dates: noticeDateLine(notice),
    label: NOTICE_KIND_LABEL[notice.kind],
    text: notice.text,
    address: notice.kind === 'relocation' ? notice.address : null,
  }
}

/** The windows a status line needs: only `closed` overrides it. */
export function statusWindows(rows: NoticeWindow[]): NoticeWindow[] {
  return rows.filter((row) => row.kind === 'closed').map((row) => ({ kind: row.kind, from: row.from, to: row.to }))
}

/** The `closed` notice in force at `at`, or null. Upcoming does not count. */
export function currentClosedNotice(rows: NoticeWindow[] | null | undefined, at: Date): NoticeWindow | null {
  const today = noticeToday(at)
  return rows?.find((row) => row.kind === 'closed' && noticeState(row, today) === 'current') ?? null
}

export type LiveAvailability = Availability & { notice?: NoticeWindow }

/**
 * A current `closed` notice wins over the schedule, including a missing or
 * unverified one, and names no opening. Nothing is written: after `to` the
 * schedule answers again.
 */
export function withNoticeStatus(value: Availability, rows: NoticeWindow[] | null | undefined, at: Date): LiveAvailability {
  const closed = currentClosedNotice(rows, at)
  if (!closed) {
    return value
  }
  return { status: 'closed', closesAt: null, opensAt: null, minutesLeft: null, minutesToOpen: null, notice: closed }
}

/** Browser status from the schedule plus the page's notices. */
export function liveStatus(
  schedule: { rules: ScheduleRules | null, verifiedAt: string | null } | null,
  rows: NoticeWindow[] | null | undefined,
  at: Date,
): LiveAvailability {
  return withNoticeStatus(statusFromRules(schedule, at), rows, at)
}

/** «Закрыто с 1 ноября 2026 по 13 ноября 2026» during a closed notice. */
export function liveStatusText(value: LiveAvailability, at: Date) {
  if (value.notice) {
    return `${NOTICE_KIND_LABEL.closed} ${noticeDateLine(value.notice)}`
  }
  return availabilityText(value, at)
}

/** True when an open-ended row was checked more than 30 days before `today`. */
export function noticeNeedsCheck(row: { to: string | null, checkedAt: string }, today: string) {
  if (row.to) {
    return false
  }
  const checked = new Date(`${row.checkedAt}T00:00:00Z`).getTime()
  const now = new Date(`${today}T00:00:00Z`).getTime()
  return now - checked > NOTICE_RECHECK_DAYS * 24 * 60 * 60 * 1000
}
