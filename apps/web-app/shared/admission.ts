import { priceFreshCutoff } from '@k39/types/freshness'

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

export const ADMISSION_MAX_ROWS = 48
export const ADMISSION_EXTRA_MAX_ROWS = 12
export const ADMISSION_EXTRA_UNITS = ['person', 'group', 'device'] as const
export type AdmissionExtraUnit = (typeof ADMISSION_EXTRA_UNITS)[number]
export const ADMISSION_UNIT_LABELS: Record<AdmissionExtraUnit, string> = {
  person: 'за человека',
  group: 'за группу',
  device: 'за устройство',
}
export const ADMISSION_CONDITION_MAX = 200
export const ADMISSION_LABEL_MAX = 80
export const PRACTICAL_SLOT = /^[a-z0-9-]{1,40}$/

export interface AdmissionRow {
  kind?: 'entry'
  unit?: null
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

export interface AdmissionExtraRow extends Omit<AdmissionRow, 'kind' | 'audience' | 'label' | 'unit'> {
  kind: 'extra'
  audience: null
  label: string
  unit: AdmissionExtraUnit | null
}

/** Storage reads include both variants; old entry fixtures may omit kind/unit. */
export type AdmissionStoredRow = Omit<AdmissionRow, 'kind' | 'audience' | 'unit'> & {
  kind?: 'entry' | 'extra'
  audience: AdmissionAudience | null
  unit?: AdmissionExtraUnit | null
}

export function partitionAdmission(rows: AdmissionStoredRow[]) {
  return {
    rows: sortAdmission(rows.filter((row): row is AdmissionRow => row.kind !== 'extra' && row.audience !== null)),
    extras: rows
      .filter((row): row is AdmissionExtraRow => row.kind === 'extra' && row.audience === null && row.label !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.slot.localeCompare(b.slot)),
  }
}

/** Field rules for one row. The slot shape and repeats are checked over the whole list. */
export function admissionRowProblem(
  row: Pick<AdmissionRow, 'audience' | 'priceRub' | 'condition' | 'label'>,
): string | null {
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

function audienceRank(audience: AdmissionAudience) {
  return ADMISSION_AUDIENCES.indexOf(audience)
}

export function sortAdmission<T extends Pick<AdmissionRow, 'audience' | 'sortOrder' | 'slot'>>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      audienceRank(a.audience) - audienceRank(b.audience) || a.sortOrder - b.sortOrder || a.slot.localeCompare(b.slot),
  )
}

export interface AdmissionLine {
  unit?: string | null
  slot: string
  label: string
  amount: string
  condition: string | null
  sourceUrl: string
  sourceTitle: string
  checkedAt: string
}

export interface AdmissionView {
  /** Any stored row, including a stale one. `places.price` is then not rendered. */
  stored: boolean
  /** Fresh rows in the public order. */
  rows: AdmissionRow[]
  lines: AdmissionLine[]
  extrasStored: boolean
  extras: AdmissionExtraRow[]
  extraLines: Array<AdmissionLine & { unit: string | null }>
}

export function admissionAmount(row: Pick<AdmissionRow, 'priceRub'>) {
  return row.priceRub === 0 ? 'бесплатно' : `${row.priceRub.toLocaleString('ru-RU')} ₽`
}

export function admissionLabel(row: Pick<AdmissionRow, 'audience' | 'label'>) {
  return row.label?.trim() || ADMISSION_LABELS[row.audience]
}

export function admissionView(rows: AdmissionStoredRow[], now = new Date()): AdmissionView {
  const cutoff = priceFreshCutoff(now)
  const stored = partitionAdmission(rows)
  const fresh = stored.rows.filter((row) => row.checkedAt >= cutoff)
  const extras = stored.extras.filter((row) => row.checkedAt >= cutoff)
  const provenance = (row: AdmissionStoredRow) => ({
    sourceUrl: row.sourceUrl,
    sourceTitle: row.sourceTitle,
    checkedAt: row.checkedAt,
  })
  return {
    stored: stored.rows.length > 0,
    rows: fresh,
    lines: fresh.map((row) => ({
      slot: row.slot,
      label: admissionLabel(row),
      amount: admissionAmount(row),
      condition: row.condition?.trim() || null,
      ...provenance(row),
    })),
    extrasStored: stored.extras.length > 0,
    extras,
    extraLines: extras.map((row) => ({
      slot: row.slot,
      label: row.label,
      amount: admissionAmount(row),
      unit: row.unit ? ADMISSION_UNIT_LABELS[row.unit] : null,
      condition: row.condition?.trim() || null,
      ...provenance(row),
    })),
  }
}

export const ADMISSION_UNKNOWN = 'Стоимость билета уточняйте'
export const ADMISSION_EXTRAS_UNKNOWN = 'Стоимость дополнительных услуг уточняйте'

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
