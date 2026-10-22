// Admission rows (ADR 0046). One ticket list per place, venue, or route.
// Shared by the writer, the renderer, the score, and JSON-LD.

export const ADMISSION_AUDIENCES = ['general', 'reduced', 'family', 'foreign', 'free'] as const
export type AdmissionAudience = (typeof ADMISSION_AUDIENCES)[number]

export const ADMISSION_LABELS: Record<AdmissionAudience, string> = {
  general: 'Взрослый',
  reduced: 'Льготный',
  family: 'Семейный',
  foreign: 'Иностранные посетители',
  free: 'Бесплатно',
}

export const ADMISSION_MAX_ROWS = 12
export const ADMISSION_CONDITION_MAX = 200
export const ADMISSION_LABEL_MAX = 80
/** The same window as `PRICE_FRESH_DAYS` in `@k39/database`. Client code cannot import that package. */
export const ADMISSION_FRESH_DAYS = 365
export const PRACTICAL_SLOT = /^[a-z0-9-]{1,40}$/

export interface AdmissionRow {
  slot: string
  audience: AdmissionAudience
  priceRub: number
  condition: string | null
  label: string | null
  sourceUrl: string
  sourceTitle: string
  checkedAt: string
  sortOrder: number
}

/** Field rules for one row. The slot shape and repeats are checked over the whole list. */
export function admissionRowProblem(row: Pick<AdmissionRow, 'audience' | 'priceRub' | 'condition' | 'label'>): string | null {
  if (!Number.isInteger(row.priceRub)) {
    return 'Цена билета: целое число рублей'
  }
  if (row.audience === 'free' && row.priceRub !== 0) {
    return 'Бесплатный вход: priceRub 0'
  }
  if (row.audience !== 'free' && row.priceRub <= 0) {
    return 'Цена билета больше 0. Бесплатный вход: audience free'
  }
  const condition = row.condition?.trim() || ''
  if ((row.audience === 'reduced' || row.audience === 'family' || row.audience === 'foreign') && !condition) {
    return `Для «${ADMISSION_LABELS[row.audience]}» нужно условие (condition)`
  }
  if (condition.length > ADMISSION_CONDITION_MAX) {
    return `Условие длиннее ${ADMISSION_CONDITION_MAX} символов`
  }
  if ((row.label?.trim() || '').length > ADMISSION_LABEL_MAX) {
    return `Название билета длиннее ${ADMISSION_LABEL_MAX} символов`
  }
  return null
}

export function admissionCutoff(now = new Date()) {
  return new Date(now.getTime() - ADMISSION_FRESH_DAYS * 86_400_000).toISOString().slice(0, 10)
}

function audienceRank(audience: AdmissionAudience) {
  return ADMISSION_AUDIENCES.indexOf(audience)
}

export function sortAdmission<T extends Pick<AdmissionRow, 'audience' | 'sortOrder' | 'slot'>>(rows: T[]): T[] {
  return [...rows].sort((a, b) => audienceRank(a.audience) - audienceRank(b.audience) || a.sortOrder - b.sortOrder || a.slot.localeCompare(b.slot))
}

export interface AdmissionLine {
  slot: string
  label: string
  amount: string
  condition: string | null
}

export interface AdmissionView {
  /** Any stored row, including a stale one. `places.price` is then not rendered. */
  stored: boolean
  /** Fresh rows in the public order. */
  rows: AdmissionRow[]
  lines: AdmissionLine[]
}

export function admissionAmount(row: Pick<AdmissionRow, 'priceRub'>) {
  return row.priceRub === 0 ? 'бесплатно' : `${row.priceRub.toLocaleString('ru-RU')} ₽`
}

export function admissionLabel(row: Pick<AdmissionRow, 'audience' | 'label'>) {
  return row.label?.trim() || ADMISSION_LABELS[row.audience]
}

export function admissionView(rows: AdmissionRow[], now = new Date()): AdmissionView {
  const cutoff = admissionCutoff(now)
  const fresh = sortAdmission(rows.filter((row) => row.checkedAt >= cutoff))
  return {
    stored: rows.length > 0,
    rows: fresh,
    lines: fresh.map((row) => ({
      slot: row.slot,
      label: admissionLabel(row),
      amount: admissionAmount(row),
      condition: row.condition?.trim() || null,
    })),
  }
}

export const ADMISSION_UNKNOWN = 'Стоимость билета уточняйте'

/** Fresh rows as schema.org offers. Nothing in a row states validity or availability. */
export function admissionOffers(view: AdmissionView) {
  return view.rows.map((row) => {
    const offer: Record<string, unknown> = {
      '@type': 'Offer',
      'name': admissionLabel(row),
      'price': row.priceRub,
      'priceCurrency': 'RUB',
      'url': row.sourceUrl,
    }
    const condition = row.condition?.trim()
    if (condition) {
      offer.description = condition
    }
    return offer
  })
}

/**
 * `isAccessibleForFree` once fresh rows exist. A fresh general price is false.
 * An unconditional free row is true. Anything else leaves the property off.
 * With no stored rows the caller keeps its reading of `places.price`.
 */
export function admissionFree(view: AdmissionView): boolean | null {
  if (view.rows.some((row) => row.audience === 'general')) {
    return false
  }
  if (view.rows.some((row) => row.audience === 'free' && !row.condition?.trim())) {
    return true
  }
  return null
}
