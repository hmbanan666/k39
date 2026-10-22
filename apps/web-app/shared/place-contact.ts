import { classifyOfficialUrl, ownWebsiteMessage, ownWebsiteProblem, PHONE_TEXT_MAX } from './facts'
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

/** The place's own site: the same rule as the venue «Сайт» (`ownWebsiteProblem`). */
export function checkPlaceWebsite(value: string | null | undefined): Checked<string | null> {
  const text = cleaned(value)
  if (!text) {
    return { ok: true, value: null }
  }
  if (text.length > PLACE_WEBSITE_MAX) {
    return { ok: false, message: `Сайт длиннее ${PLACE_WEBSITE_MAX} символов` }
  }
  const problem = ownWebsiteProblem(text)
  if (problem) {
    return { ok: false, message: ownWebsiteMessage(problem) }
  }
  return { ok: true, value: text }
}

/**
 * Where the phone was read: a page on the place's own site. A place has no
 * `socials` to prove a social page is its own, so a social page counts only
 * while `website` is empty, the same rule as a venue VK menu. Maps, listings,
 * and Google or Yandex services never count.
 */
export function checkPlacePhoneSource(value: string | null | undefined, website: string | null): Checked<string> {
  const text = cleaned(value)
  if (!text) {
    return { ok: false, message: 'Укажите официальный источник телефона: phoneSourceUrl или сайт места' }
  }
  const kind = classifyOfficialUrl(text)
  if (kind === 'official' || (kind === 'social' && !website)) {
    return { ok: true, value: text }
  }
  if (kind === 'invalid') {
    return { ok: false, message: 'Источник телефона должен быть ссылкой http:// или https://' }
  }
  if (kind === 'social') {
    return { ok: false, message: 'У места есть сайт: телефон берите со страницы этого сайта, не из соцсети' }
  }
  return { ok: false, message: 'Телефон места берите только с официального сайта или официальной страницы места, не с карты, агрегатора или сервиса Яндекса и Google' }
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
