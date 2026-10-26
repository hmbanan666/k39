import type { PublicMedia } from './media'
import { WRITING_BANNED_SITES } from './writing'

export const GUEST_KINDS = ['review', 'tip', 'photo', 'correction'] as const
export type GuestKind = (typeof GUEST_KINDS)[number]

export const GUEST_CORRECTION_KINDS = ['hours', 'phone', 'address', 'status', 'price', 'other'] as const
export type GuestCorrectionKind = (typeof GUEST_CORRECTION_KINDS)[number]

export const GUEST_REVIEW_MIN = 80
export const GUEST_REVIEW_MAX = 1200
export const GUEST_TIP_MIN = 40
export const GUEST_TIP_MAX = 400
export const GUEST_ALT_MIN = 10
export const GUEST_ALT_MAX = 140
export const GUEST_VALUE_MAX = 120
export const GUEST_NOTE_MAX = 400

export const GUEST_KIND_LABELS: Record<'review' | 'tip' | 'photo', string> = {
  review: 'Отзыв',
  tip: 'Совет',
  photo: 'Фото гостя',
}

export const GUEST_DISCLAIMER =
  'Это сообщения посетителей. Редакция не проверяла их как факты. Часы и цены на странице остаются сверенными с источниками.'

const EMAIL_RE = /[\w.%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i
const HTTP_RE = /https?:\/\/[^\s<>"']+/gi
const WWW_RE = /\bwww\.[^\s<>"']+/i

export interface GuestTextPart {
  type: 'text' | 'link'
  text: string
  href?: string
}

export interface GuestPublicItem {
  id: string
  kind: 'review' | 'tip' | 'photo'
  byline: string
  acceptedAt: string
  dateLabel: string
  body: string
  parts: GuestTextPart[]
  alt: string
  media: PublicMedia | null
}

export function guestByline(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = words[0]
  if (!first) {
    return 'Гость'
  }
  if (words.length === 1) {
    return first
  }
  const last = words[words.length - 1] ?? ''
  const initial = Array.from(last)[0]
  if (!initial) {
    return first
  }
  return `${first} ${initial.toLocaleUpperCase('ru')}.`
}

export function normalizeGuestBody(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function guestDay(iso: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kaliningrad',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

export function guestDateLabel(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Kaliningrad',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

export function guestReviewNodes(
  itemId: string,
  items: Array<{ kind: string; byline: string; body: string; acceptedAt: string }>,
) {
  return items.flatMap((item) => {
    if (item.kind !== 'review' || !item.body.trim() || !item.byline.trim()) {
      return []
    }
    return [
      {
        '@type': 'Review',
        'author': { '@type': 'Person', 'name': item.byline },
        'datePublished': guestDay(item.acceptedAt),
        'reviewBody': item.body,
        'inLanguage': 'ru',
        'itemReviewed': { '@id': itemId },
      },
    ]
  })
}

function trimUrl(raw: string) {
  return raw.replace(/[),.;:!?]+$/g, '')
}

function isPrivateHost(host: string) {
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return true
  }
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!ipv4) {
    return host === '::1' || host === '0.0.0.0'
  }
  const parts = ipv4.slice(1).map((part) => Number(part))
  const a = parts[0] ?? -1
  const b = parts[1] ?? -1
  if (parts.some((part) => part > 255)) {
    return true
  }
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 169 && b === 254)
  )
}

function bannedHost(host: string) {
  return WRITING_BANNED_SITES.some((site) => host === site || host.endsWith(`.${site}`))
}

/** One public https URL, or a reason the text cannot be stored. */
export function inspectGuestUrl(raw: string): { ok: true; url: URL } | { ok: false; message: string } {
  let url: URL
  try {
    url = new URL(trimUrl(raw))
  } catch {
    return { ok: false, message: 'Ссылка должна быть обычным адресом https.' }
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    return { ok: false, message: 'Ссылка должна быть обычным адресом https.' }
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (!host.includes('.') || isPrivateHost(host) || bannedHost(host)) {
    return { ok: false, message: 'Такую ссылку публиковать нельзя.' }
  }
  return { ok: true, url }
}

// Optional +7 / 8 / 7, then ten national digits, or ten digits with no prefix.
// Spaces, dashes and parentheses are separators. A dot is not, so a date
// (dd.mm.yyyy) cannot join into a number. A spaced hyphen is a range.
const PHONE_RE = /(?<!\d)\+?\s*(?:\d[\s()-]*){9,10}\d(?!\d)/gu

function phoneFragment(text: string) {
  PHONE_RE.lastIndex = 0
  for (const match of text.matchAll(PHONE_RE)) {
    const fragment = match[0].trim()
    if (/\d\s+-\s+\d/u.test(fragment) || /\d{1,2}\.\d{1,2}\.\d{4}/u.test(fragment)) {
      continue
    }
    const digits = fragment.replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 11) {
      continue
    }
    if (digits.length === 11 && digits[0] !== '7' && digits[0] !== '8') {
      continue
    }
    return fragment
  }
  return ''
}

export function inspectGuestText(
  text: string,
  options?: { allowPhone?: boolean },
): { ok: true; body: string } | { ok: false; message: string } {
  const body = text.trim()
  if (EMAIL_RE.test(body)) {
    return { ok: false, message: 'Уберите адрес электронной почты из текста.' }
  }
  const phone = phoneFragment(body)
  if (!options?.allowPhone && phone) {
    return { ok: false, message: `Уберите номер телефона из текста: «${phone}».` }
  }
  if (WWW_RE.test(body)) {
    return { ok: false, message: 'В тексте можно оставить только одну ссылку https.' }
  }
  const found = [...body.matchAll(HTTP_RE)].map((match) => match[0])
  if (found.some((item) => item.toLowerCase().startsWith('http://'))) {
    return { ok: false, message: 'Ссылка должна начинаться с https.' }
  }
  const https = found.filter((item) => item.toLowerCase().startsWith('https://'))
  if (https.length > 1) {
    return { ok: false, message: 'В тексте можно оставить только одну ссылку.' }
  }
  if (https.length === 1) {
    const checked = inspectGuestUrl(https[0] ?? '')
    if (!checked.ok) {
      return checked
    }
  }
  return { ok: true, body }
}

export function guestParts(text: string): GuestTextPart[] {
  const match = /https:\/\/[^\s<>"']+/i.exec(text)
  if (!match || match.index == null) {
    return [{ type: 'text', text }]
  }
  const raw = match[0]
  const href = trimUrl(raw)
  const checked = inspectGuestUrl(href)
  if (!checked.ok) {
    return [{ type: 'text', text }]
  }
  const start = match.index
  const end = start + raw.length
  const parts: GuestTextPart[] = []
  if (start > 0) {
    parts.push({ type: 'text', text: text.slice(0, start) })
  }
  parts.push({ type: 'link', text: checked.url.hostname, href: checked.url.toString() })
  if (end < text.length) {
    parts.push({ type: 'text', text: text.slice(end) })
  }
  return parts
}

export function lengthProblem(kind: 'review' | 'tip' | 'alt' | 'value' | 'note', text: string) {
  const length = text.trim().length
  if (kind === 'review' && (length < GUEST_REVIEW_MIN || length > GUEST_REVIEW_MAX)) {
    return `Отзыв: от ${GUEST_REVIEW_MIN} до ${GUEST_REVIEW_MAX} знаков.`
  }
  if (kind === 'tip' && (length < GUEST_TIP_MIN || length > GUEST_TIP_MAX)) {
    return `Совет: от ${GUEST_TIP_MIN} до ${GUEST_TIP_MAX} знаков.`
  }
  if (kind === 'alt' && (length < GUEST_ALT_MIN || length > GUEST_ALT_MAX)) {
    return `Подпись к фото: от ${GUEST_ALT_MIN} до ${GUEST_ALT_MAX} знаков.`
  }
  if (kind === 'value' && (length < 1 || length > GUEST_VALUE_MAX)) {
    return `Поправка: от 1 до ${GUEST_VALUE_MAX} знаков.`
  }
  if (kind === 'note' && length > GUEST_NOTE_MAX) {
    return `Пояснение: до ${GUEST_NOTE_MAX} знаков.`
  }
  return ''
}

/** Shown to the author when a photo is rejected because a person can be recognized. */
export const GUEST_FACE_REJECT_NOTE = 'На фото узнаваемый человек. Такие снимки не публикуем.'

/**
 * One decision for the admin queue and the editor-token tools.
 * A photo the caller marks as a recognizable face is a reject, not an accept.
 */
export function routeGuestDecision(input: {
  kind: string | null
  decision: 'accept' | 'reject' | 'dispute'
  recognizableFace?: boolean
  note?: string
}): { decision: 'accept' | 'reject' | 'dispute'; note: string | null } {
  if (input.decision === 'accept' && input.kind === 'photo' && input.recognizableFace === true) {
    return { decision: 'reject', note: GUEST_FACE_REJECT_NOTE }
  }
  if (input.decision === 'reject') {
    return { decision: 'reject', note: input.note ?? '' }
  }
  return { decision: input.decision, note: null }
}

/** A venue member does not review their own venue. Status corrections stay allowed. */
export function memberGuestBlock(kind: GuestKind, correctionKind: string | null) {
  if (kind === 'review' || kind === 'tip' || kind === 'photo') {
    return 'Отзыв, совет и фото своего заведения оставляют через кабинет.'
  }
  if (kind === 'correction' && correctionKind && correctionKind !== 'status' && correctionKind !== 'other') {
    return 'Часы, телефон, адрес и цены своего заведения правятся в кабинете.'
  }
  return ''
}
