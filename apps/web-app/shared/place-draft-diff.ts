/**
 * Readable field diff between a live place and the row an editor publish
 * would write from `content_drafts`. Display strings are Russian.
 */

export interface PlaceDraftSide {
  title: string
  slug: string
  summary: string
  body: string
  status: string
  hours: string | null
  price: string | null
  howToGet: string | null
  latitude: number | null
  longitude: number | null
  categoryId: string | null
  regionId: string | null
  sources: unknown
  seoTitle: string | null
  seoDescription: string | null
  ogImage: string | null
  noindex: boolean
  visitDuration: string | null
  bestTime: string | null
  faq: unknown
  lastVerifiedAt: string | null
  authorKind: string
  publicationStatus: string
}

export interface PlaceDraftNames {
  category?: ReadonlyMap<string, string>
  region?: ReadonlyMap<string, string>
}

export interface PlaceDraftChange {
  field: string
  label: string
  live: string
  draft: string
}

export interface PlaceDraftNotice {
  updatedAt: string
  updatedLabel: string
  publicationStatus: 'draft' | 'review'
  changes: PlaceDraftChange[]
}

const VISIT: Record<string, string> = {
  open: 'открыт',
  ruins: 'руины',
  closed: 'закрыт',
  unknown: 'неизвестно',
}

const PUBLICATION: Record<string, string> = {
  draft: 'черновик',
  review: 'на проверке',
  published: 'опубликовано',
  archived: 'в архиве',
}

const AUTHOR: Record<string, string> = {
  human: 'человек',
  ai: 'агент',
}

const EMPTY = 'пусто'

function prose(value: string | null | undefined) {
  return (value ?? '').replace(/\r\n/g, '\n').trim()
}

function shown(value: string) {
  return value || EMPTY
}

function labeled(value: string, labels: Record<string, string>) {
  return labels[value] || value || EMPTY
}

function faqText(value: unknown) {
  if (!Array.isArray(value)) {
    return ''
  }
  return value.map((item) => {
    if (!item || typeof item !== 'object') {
      return ''
    }
    const row = item as { question?: unknown, answer?: unknown }
    const question = typeof row.question === 'string' ? row.question.trim() : ''
    const answer = typeof row.answer === 'string' ? row.answer.trim() : ''
    return [question, answer].filter(Boolean).join('\n')
  }).filter(Boolean).join('\n\n')
}

export function sourceText(value: unknown) {
  if (!Array.isArray(value)) {
    return ''
  }
  return value.map((item) => {
    if (!item || typeof item !== 'object') {
      return ''
    }
    const row = item as { title?: unknown, url?: unknown }
    const title = typeof row.title === 'string' ? row.title.trim() : ''
    const url = typeof row.url === 'string' ? row.url.trim() : ''
    return [title, url].filter(Boolean).join('\n')
  }).filter(Boolean).join('\n\n')
}

function point(value: number | null) {
  if (value == null || Number.isNaN(Number(value))) {
    return ''
  }
  return String(Number(value))
}

function timeKey(value: string | null) {
  if (!value) {
    return ''
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? value : String(parsed)
}

function timeText(value: string | null) {
  if (!value) {
    return ''
  }
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return value
  }
  return new Intl.DateTimeFormat('ru', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kaliningrad',
  }).format(parsed)
}

function named(id: string | null, map?: ReadonlyMap<string, string>) {
  if (!id) {
    return ''
  }
  return map?.get(id) || id
}

interface Read {
  key: string
  text: string
}

export function textRead(value: string | null | undefined): Read {
  const text = prose(value)
  return { key: text, text }
}

export function diffFields(fields: Array<{ field: string, label: string, live: Read, draft: Read }>): PlaceDraftChange[] {
  const changes: PlaceDraftChange[] = []
  for (const field of fields) {
    if (field.live.key === field.draft.key) {
      continue
    }
    changes.push({
      field: field.field,
      label: field.label,
      live: shown(field.live.text),
      draft: shown(field.draft.text),
    })
  }
  return changes
}

const FIELDS: Array<{
  field: string
  label: string
  read: (side: PlaceDraftSide, names: PlaceDraftNames) => Read
}> = [
  { field: 'title', label: 'Название', read: (side) => textRead(side.title) },
  { field: 'slug', label: 'Адрес', read: (side) => textRead(side.slug) },
  {
    field: 'categoryId',
    label: 'Раздел',
    read: (side, names) => ({ key: side.categoryId ?? '', text: named(side.categoryId, names.category) }),
  },
  {
    field: 'status',
    label: 'Статус объекта',
    read: (side) => ({ key: side.status, text: labeled(side.status, VISIT) }),
  },
  {
    field: 'publicationStatus',
    label: 'Публикация',
    read: (side) => ({ key: side.publicationStatus, text: labeled(side.publicationStatus, PUBLICATION) }),
  },
  { field: 'summary', label: 'Кратко', read: (side) => textRead(side.summary) },
  { field: 'body', label: 'Текст', read: (side) => textRead(side.body) },
  { field: 'hours', label: 'Часы', read: (side) => textRead(side.hours) },
  { field: 'price', label: 'Цена', read: (side) => textRead(side.price) },
  { field: 'howToGet', label: 'Как добраться', read: (side) => textRead(side.howToGet) },
  { field: 'latitude', label: 'Широта', read: (side) => ({ key: point(side.latitude), text: point(side.latitude) }) },
  { field: 'longitude', label: 'Долгота', read: (side) => ({ key: point(side.longitude), text: point(side.longitude) }) },
  { field: 'seoTitle', label: 'SEO title', read: (side) => textRead(side.seoTitle) },
  { field: 'seoDescription', label: 'SEO description', read: (side) => textRead(side.seoDescription) },
  { field: 'ogImage', label: 'Картинка для соцсетей', read: (side) => textRead(side.ogImage) },
  {
    field: 'noindex',
    label: 'Индексация',
    read: (side) => ({ key: side.noindex ? '1' : '0', text: side.noindex ? 'не индексировать' : 'в индексе' }),
  },
  {
    field: 'regionId',
    label: 'Регион',
    read: (side, names) => ({ key: side.regionId ?? '', text: named(side.regionId, names.region) }),
  },
  { field: 'visitDuration', label: 'Сколько времени', read: (side) => textRead(side.visitDuration) },
  { field: 'bestTime', label: 'Когда ехать', read: (side) => textRead(side.bestTime) },
  { field: 'faq', label: 'Вопросы', read: (side) => ({ key: faqText(side.faq), text: faqText(side.faq) }) },
  { field: 'sources', label: 'Источники', read: (side) => ({ key: sourceText(side.sources), text: sourceText(side.sources) }) },
  {
    field: 'authorKind',
    label: 'Кто написал',
    read: (side) => ({ key: side.authorKind, text: labeled(side.authorKind, AUTHOR) }),
  },
  {
    field: 'lastVerifiedAt',
    label: 'Проверено',
    read: (side) => ({ key: timeKey(side.lastVerifiedAt), text: timeText(side.lastVerifiedAt) }),
  },
]

export function placeDraftChanges(live: PlaceDraftSide, draft: PlaceDraftSide, names: PlaceDraftNames = {}): PlaceDraftChange[] {
  return diffFields(FIELDS.map((field) => ({
    field: field.field,
    label: field.label,
    live: field.read(live, names),
    draft: field.read(draft, names),
  })))
}

export function formatDraftUpdated(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return 'Сохранён'
  }
  const formatted = new Intl.DateTimeFormat('ru', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kaliningrad',
  }).format(date)
  return `Сохранён ${formatted}`
}
