import { classifySourceUrl, PHONE_TEXT_MAX } from './facts'
import { phoneE164List } from './phone'
import { isPlaceSchemaType, PLACE_SCHEMA_TYPES } from './seo'

// Official contact fields of a place (#238) and its schema.org subtype (#239).
// Each check returns the cleaned value or an error message in Russian, so the
// MCP, REST, and admin writers share one rule set.

export const PLACE_WEBSITE_MAX = 300

export type Checked<T> = { ok: true, value: T } | { ok: false, message: string }

function cleaned(value: string | null | undefined) {
  const text = value?.replace(/\s+/g, ' ').trim()
  return text || null
}

function httpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** A place phone needs at least one complete Russian number. «уточняйте» is an empty field, not a phone. */
export function checkPlacePhone(value: string | null | undefined): Checked<string | null> {
  const text = cleaned(value)
  if (!text) {
    return { ok: true, value: null }
  }
  if (text.length > PHONE_TEXT_MAX) {
    return { ok: false, message: `Телефон длиннее ${PHONE_TEXT_MAX} символов` }
  }
  if (!phoneE164List(text).length) {
    return { ok: false, message: 'Укажите телефон полностью, например +7 4012 30-30-40' }
  }
  return { ok: true, value: text }
}

/** The place's own site. A social page or a map card is not a website. */
export function checkPlaceWebsite(value: string | null | undefined): Checked<string | null> {
  const text = cleaned(value)
  if (!text) {
    return { ok: true, value: null }
  }
  if (text.length > PLACE_WEBSITE_MAX || !httpUrl(text)) {
    return { ok: false, message: 'Сайт должен быть ссылкой http:// или https://' }
  }
  if (classifySourceUrl(text) !== 'official') {
    return { ok: false, message: 'В поле «Сайт» укажите только официальный сайт места. Соцсеть или карта сюда не подходят.' }
  }
  return { ok: true, value: text }
}

/**
 * Where the phone was read. A place phone comes from the official site or the
 * place's own social page only. Maps are venue-only (`mapSourceAllowed`).
 */
export function checkPlacePhoneSource(value: string | null | undefined): Checked<string> {
  const text = cleaned(value)
  if (!text) {
    return { ok: false, message: 'Укажите официальный источник телефона: phoneSourceUrl или сайт места' }
  }
  if (!httpUrl(text)) {
    return { ok: false, message: 'Источник телефона должен быть ссылкой http:// или https://' }
  }
  const kind = classifySourceUrl(text)
  if (kind !== 'official' && kind !== 'official_social') {
    return { ok: false, message: 'Телефон места берите только с официального сайта или официальной страницы места, не с карты' }
  }
  return { ok: true, value: text }
}

export function checkPlaceSchemaType(value: string | null | undefined): Checked<string | null> {
  const text = cleaned(value)
  if (!text) {
    return { ok: true, value: null }
  }
  if (!isPlaceSchemaType(text)) {
    return { ok: false, message: `Тип schema.org должен быть одним из: ${PLACE_SCHEMA_TYPES.join(', ')}` }
  }
  return { ok: true, value: text }
}
