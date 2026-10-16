import type { H3Event } from 'h3'
import type { GuestCorrectionKind, GuestKind } from '../../../shared/guest'
import { db } from '@k39/database'
import { createError } from 'h3'
import { CONSENT_VERSION, GUEST_CONSENT_METHOD, GUEST_CONSENT_VERSION } from '../../../shared/consent'
import { GUEST_CORRECTION_KINDS, inspectGuestText, inspectGuestUrl, lengthProblem, memberGuestBlock, normalizeGuestBody } from '../../../shared/guest'
import { requireAccount } from '../cabinet/account'
import { limitGuestSubmit } from '../cabinet/rate'

const WRITE_MESSAGES = {
  pending: 'Такое сообщение уже ждёт решения.',
  duplicate: 'Такой текст уже есть на этой странице.',
  cap: 'Сначала уберите прежнее сообщение в кабинете.',
} as const

export async function requireGuestAuthor(event: H3Event) {
  const user = await requireAccount(event)
  if (user.role === 'admin' || user.role === 'editor') {
    throw createError({ statusCode: 403, statusMessage: 'Редакция правит страницу в админке.' })
  }
  const account = await db.consent.active(user.id, CONSENT_VERSION)
  if (!account) {
    throw createError({ statusCode: 403, statusMessage: 'Сначала подтвердите согласие при входе.' })
  }
  return user
}

export function requireGuestConsent(consent: unknown) {
  if (consent !== '1') {
    throw createError({ statusCode: 400, statusMessage: 'Отправка без согласия ничего не сохраняет.' })
  }
}

function isGuestSubject(value: unknown): value is 'place' | 'venue' {
  return value === 'place' || value === 'venue'
}

export async function resolveGuestSubject(subjectType: unknown, subjectSlug: unknown) {
  if (!isGuestSubject(subjectType)) {
    throw createError({ statusCode: 400, statusMessage: 'Нужна страница места или заведения.' })
  }
  if (typeof subjectSlug !== 'string' || !subjectSlug.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Нужна страница места или заведения.' })
  }
  const slug = subjectSlug.trim()
  if (subjectType === 'place') {
    const loaded = await db.content.publishedPlace(slug)
    if (!loaded) {
      throw createError({ statusCode: 404, statusMessage: 'Страница не принимает сообщения.' })
    }
    return { subjectType, subjectId: loaded.place.id, path: `/${loaded.place.slug}`, title: loaded.place.title }
  }
  const venue = await db.venues.bySlug(slug)
  if (!venue || (venue.status !== 'published' && venue.status !== 'closed')) {
    throw createError({ statusCode: 404, statusMessage: 'Страница не принимает сообщения.' })
  }
  return { subjectType, subjectId: venue.id, path: `/zavedeniya/${venue.slug}`, title: venue.name }
}

async function assertMemberRules(userId: string, subjectType: 'place' | 'venue', subjectId: string, kind: GuestKind, correctionKind: string | null) {
  if (subjectType !== 'venue') {
    return
  }
  const member = await db.venueClaims.member(subjectId, userId)
  if (!member) {
    return
  }
  const message = memberGuestBlock(kind, correctionKind)
  if (message) {
    throw createError({ statusCode: 403, statusMessage: message })
  }
}

function correctionKindOf(value: unknown): GuestCorrectionKind {
  if (typeof value === 'string' && (GUEST_CORRECTION_KINDS as readonly string[]).includes(value)) {
    return value as GuestCorrectionKind
  }
  throw createError({ statusCode: 400, statusMessage: 'Укажите, что именно поправить.' })
}

export async function submitGuestText(event: H3Event, input: {
  consent: unknown
  subjectType: unknown
  subjectSlug: unknown
  kind: unknown
  body?: unknown
  correctionKind?: unknown
  correctionValue?: unknown
  note?: unknown
  sourceUrl?: unknown
}) {
  requireGuestConsent(input.consent)
  const user = await requireGuestAuthor(event)
  const subject = await resolveGuestSubject(input.subjectType, input.subjectSlug)
  if (input.kind !== 'review' && input.kind !== 'tip' && input.kind !== 'correction') {
    throw createError({ statusCode: 400, statusMessage: 'Выберите отзыв, совет или поправку.' })
  }
  const kind = input.kind
  const correctionKind = kind === 'correction' ? correctionKindOf(input.correctionKind) : null
  await assertMemberRules(user.id, subject.subjectType, subject.subjectId, kind, correctionKind)

  let body: string | null = null
  let bodyKey: string | null = null
  let correctionValue: string | null = null
  let sourceUrl: string | null = null

  if (kind === 'review' || kind === 'tip') {
    const text = typeof input.body === 'string' ? input.body : ''
    const sized = lengthProblem(kind, text)
    const checked = inspectGuestText(text)
    const message = sized || (checked.ok ? '' : checked.message)
    if (message) {
      throw createError({ statusCode: 400, statusMessage: message })
    }
    if (!checked.ok) {
      throw createError({ statusCode: 400, statusMessage: 'Проверьте текст.' })
    }
    body = checked.body
    bodyKey = normalizeGuestBody(checked.body)
  } else {
    const value = typeof input.correctionValue === 'string' ? input.correctionValue : ''
    const note = typeof input.note === 'string' ? input.note : ''
    const valueProblem = lengthProblem('value', value)
    const noteProblem = lengthProblem('note', note)
    const valueCheck = inspectGuestText(value, { allowPhone: correctionKind === 'phone' })
    const noteCheck = note.trim() ? inspectGuestText(note) : { ok: true as const, body: '' }
    if (valueProblem || noteProblem || !valueCheck.ok || !noteCheck.ok) {
      const message = valueProblem || noteProblem || (!valueCheck.ok ? valueCheck.message : '') || (!noteCheck.ok ? noteCheck.message : '')
      throw createError({ statusCode: 400, statusMessage: message || 'Проверьте поправку.' })
    }
    correctionValue = valueCheck.body
    body = noteCheck.ok ? noteCheck.body || null : null
    if (typeof input.sourceUrl === 'string' && input.sourceUrl.trim()) {
      const url = inspectGuestUrl(input.sourceUrl.trim())
      if (!url.ok) {
        throw createError({ statusCode: 400, statusMessage: url.message })
      }
      sourceUrl = url.url.toString()
    }
  }

  limitGuestSubmit(user.id)
  await db.consent.record({ userId: user.id, version: GUEST_CONSENT_VERSION, method: GUEST_CONSENT_METHOD })
  const created = await db.guests.create({
    userId: user.id,
    subjectType: subject.subjectType,
    subjectId: subject.subjectId,
    kind,
    body,
    alt: null,
    correctionKind,
    correctionValue,
    sourceUrl,
    mediaId: null,
    bodyKey,
  })
  if (!created.ok) {
    throw createError({ statusCode: 409, statusMessage: WRITE_MESSAGES[created.reason] })
  }
  return { id: created.id, status: 'pending' as const }
}
