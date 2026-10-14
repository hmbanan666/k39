// Page text and the schedule must never contradict each other: a page that
// says «закрыт на реставрацию» cannot show hours, and «по записи» needs the
// appointment mode. Used by content scores to flag pages for review.

const CLOSED = /(?:закрыт\p{L}*|не работает)\s+(?:на|для|в связи с)\s+(?:реставрац|ремонт|реконструкц|консервац|посещени)|временно\s+(?:закрыт|не работает|не принимает)|(?:сейчас|пока)\s+(?:закрыт|не работает)|на реставрации|на реконструкции|посещение невозможно|не открыт\p{L}* для посещени|не приспособлен\p{L}* (?:для|к) посещени|свободного доступа нет|(?:осмотр\s+)?только\s+(?:осмотр\s+)?снаружи|внутрь\s+(?:\p{L}+\s+)?не пускают|^закрыт/imu
const APPOINTMENT = /по\s+(?:предварительн\p{L}*\s+)?(?:записи|договор[её]нност|заявк)/iu

export interface StatusCheckInput {
  text: string
  /** Schedule rules mode; null when the page has no schedule. */
  mode: string | null
}

/** Short English check strings, empty when text and status agree. */
export function statusContradictions(input: StatusCheckInput): string[] {
  // Sentences that link elsewhere usually describe the neighbours.
  const own = input.text.split(/(?<=[.!?])\s+|\n+/).filter((sentence) => !sentence.includes('](/')).join('\n')
  const closedText = CLOSED.test(own)
  const appointmentText = APPOINTMENT.test(own)
  const checks: string[] = []
  if (closedText && input.mode !== 'closed') {
    checks.push(`text says closed, schedule mode is ${input.mode ?? 'missing'}`)
  }
  if (input.mode === 'closed' && !closedText) {
    checks.push('schedule closed, text does not say so')
  }
  if (input.mode === 'appointment' && !appointmentText) {
    checks.push('schedule by appointment, text does not say how to book')
  }
  if (appointmentText && !closedText && input.mode === 'always') {
    checks.push('text says by appointment, schedule is always open')
  }
  return checks
}
