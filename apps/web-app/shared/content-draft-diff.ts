/**
 * Field diff for a pending collection or route draft. Display strings are Russian.
 * The comparison loop is the same one the place form uses.
 */

import type { PlaceDraftChange, PlaceDraftNotice } from './place-draft-diff'
import { diffFields, sourceText, textRead } from './place-draft-diff'

export type ContentDraftChange = PlaceDraftChange
export type ContentDraftNotice = PlaceDraftNotice

interface Read {
  key: string
  text: string
}

function flag(value: boolean, on: string, off: string): Read {
  return { key: value ? '1' : '0', text: value ? on : off }
}

function lines(value: string): Read {
  return textRead(value)
}

function stopText(stops: Array<{ placeSlug: string, note?: string | null }> | null | undefined) {
  if (!stops?.length) {
    return ''
  }
  return stops.map((stop) => {
    const note = stop.note?.trim()
    return note ? `${stop.placeSlug}: ${note}` : stop.placeSlug
  }).join('\n')
}

function moduleText(modules: unknown) {
  if (!Array.isArray(modules) || modules.length === 0) {
    return ''
  }
  return modules.map((item, index) => {
    if (!item || typeof item !== 'object') {
      return String(index + 1)
    }
    const row = item as { type?: unknown, title?: unknown, text?: unknown }
    const type = typeof row.type === 'string' ? row.type : ''
    const title = typeof row.title === 'string' ? row.title.trim() : ''
    const text = typeof row.text === 'string' ? row.text.trim() : ''
    return [String(index + 1), type, title, text].filter(Boolean).join(' ')
  }).join('\n')
}

function pathText(path: [number, number][] | null | undefined) {
  if (!path?.length) {
    return ''
  }
  return path.map(([longitude, latitude]) => `${longitude}, ${latitude}`).join('\n')
}

const KIND: Record<string, string> = {
  theme: 'тема',
  month: 'месяц',
}

const PUBLICATION: Record<string, string> = {
  draft: 'черновик',
  review: 'на проверке',
  published: 'опубликовано',
  archived: 'в архиве',
}

export interface CollectionDraftSide {
  title: string
  slug: string
  summary: string | null
  body: string
  seoTitle: string | null
  seoDescription: string | null
  ogImage: string | null
  noindex: boolean
  kind: string
  month: number | null
  sources: unknown
  modules: unknown
  items: Array<{ placeSlug: string, note?: string | null }>
  publicationStatus: string
}

export interface RouteDraftSide {
  title: string
  slug: string
  summary: string | null
  body: string
  seoTitle: string | null
  seoDescription: string | null
  ogImage: string | null
  noindex: boolean
  points: Array<{ placeSlug: string, note?: string | null }>
  path: [number, number][] | null
  publicationStatus: string
}

function publicationRead(value: string): Read {
  return { key: value, text: PUBLICATION[value] || value }
}

export function collectionDraftChanges(live: CollectionDraftSide, draft: CollectionDraftSide): ContentDraftChange[] {
  const fields: Array<{ field: string, label: string, live: Read, draft: Read }> = [
    { field: 'title', label: 'Название', live: textRead(live.title), draft: textRead(draft.title) },
    { field: 'slug', label: 'Адрес', live: textRead(live.slug), draft: textRead(draft.slug) },
    { field: 'summary', label: 'Кратко', live: textRead(live.summary), draft: textRead(draft.summary) },
    { field: 'body', label: 'Текст', live: textRead(live.body), draft: textRead(draft.body) },
    { field: 'kind', label: 'Вид', live: { key: live.kind, text: KIND[live.kind] || live.kind }, draft: { key: draft.kind, text: KIND[draft.kind] || draft.kind } },
    { field: 'month', label: 'Месяц', live: textRead(live.month == null ? '' : String(live.month)), draft: textRead(draft.month == null ? '' : String(draft.month)) },
    { field: 'items', label: 'Места', live: lines(stopText(live.items)), draft: lines(stopText(draft.items)) },
    { field: 'modules', label: 'Модули', live: lines(moduleText(live.modules)), draft: lines(moduleText(draft.modules)) },
    { field: 'sources', label: 'Источники', live: lines(sourceText(live.sources)), draft: lines(sourceText(draft.sources)) },
    { field: 'seoTitle', label: 'SEO title', live: textRead(live.seoTitle), draft: textRead(draft.seoTitle) },
    { field: 'seoDescription', label: 'SEO description', live: textRead(live.seoDescription), draft: textRead(draft.seoDescription) },
    { field: 'ogImage', label: 'Картинка для соцсетей', live: textRead(live.ogImage), draft: textRead(draft.ogImage) },
    { field: 'noindex', label: 'Индексация', live: flag(live.noindex, 'не индексировать', 'в индексе'), draft: flag(draft.noindex, 'не индексировать', 'в индексе') },
    { field: 'publicationStatus', label: 'Публикация', live: publicationRead(live.publicationStatus), draft: publicationRead(draft.publicationStatus) },
  ]
  return diffFields(fields)
}

export function routeDraftChanges(live: RouteDraftSide, draft: RouteDraftSide): ContentDraftChange[] {
  const fields: Array<{ field: string, label: string, live: Read, draft: Read }> = [
    { field: 'title', label: 'Название', live: textRead(live.title), draft: textRead(draft.title) },
    { field: 'slug', label: 'Адрес', live: textRead(live.slug), draft: textRead(draft.slug) },
    { field: 'summary', label: 'Кратко', live: textRead(live.summary), draft: textRead(draft.summary) },
    { field: 'body', label: 'Текст', live: textRead(live.body), draft: textRead(draft.body) },
    { field: 'points', label: 'Остановки', live: lines(stopText(live.points)), draft: lines(stopText(draft.points)) },
    { field: 'path', label: 'Линия на карте', live: lines(pathText(live.path)), draft: lines(pathText(draft.path)) },
    { field: 'seoTitle', label: 'SEO title', live: textRead(live.seoTitle), draft: textRead(draft.seoTitle) },
    { field: 'seoDescription', label: 'SEO description', live: textRead(live.seoDescription), draft: textRead(draft.seoDescription) },
    { field: 'ogImage', label: 'Картинка для соцсетей', live: textRead(live.ogImage), draft: textRead(draft.ogImage) },
    { field: 'noindex', label: 'Индексация', live: flag(live.noindex, 'не индексировать', 'в индексе'), draft: flag(draft.noindex, 'не индексировать', 'в индексе') },
    { field: 'publicationStatus', label: 'Публикация', live: publicationRead(live.publicationStatus), draft: publicationRead(draft.publicationStatus) },
  ]
  return diffFields(fields)
}
