export interface MonthGuideRow {
  slug: string
  title: string
  kind: string
  month: number | null
}

/** Month guides first, in calendar order, then themed collections in the given order. */
export function splitCollections<T extends MonthGuideRow>(rows: T[]) {
  const months = rows
    .filter((row) => row.kind === 'month' && row.month !== null)
    .sort((a, b) => (a.month ?? 0) - (b.month ?? 0))
  const themes = rows.filter((row) => !months.includes(row))
  return { months, themes }
}

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

/** Short Russian month name for chips, from a 1-based month number. */
export function monthName(month: number | null | undefined) {
  return month && month >= 1 && month <= 12 ? MONTH_NAMES[month - 1]! : ''
}
