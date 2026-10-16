export const GUEST_CORRECTION_KINDS = ['hours', 'phone', 'address', 'status', 'price', 'other'] as const
export type GuestCorrectionKind = (typeof GUEST_CORRECTION_KINDS)[number]

export interface GuestFactHint {
  id: string
  kind: string
  slot: string
  itemSlug: string | null
}

export interface GuestReportProposal {
  submissionId: string
  text: string
  url: string | null
  count: number
}

export function guestSectionPath(kind: string) {
  return `guest:${kind}`
}

/** One live fact, or the single price the text names. Otherwise the section path. */
export function matchGuestFact(kind: string, value: string, facts: GuestFactHint[]) {
  if (kind === 'other') {
    return null
  }
  const live = facts.filter((fact) => fact.kind === kind)
  if (kind === 'price') {
    const text = value.toLowerCase()
    const named = live.filter((fact) => {
      const slug = fact.itemSlug?.toLowerCase() ?? ''
      const slot = fact.slot.toLowerCase()
      return (slug.length > 0 && text.includes(slug)) || (slot.length > 0 && text.includes(slot))
    })
    if (named.length === 1) {
      return named[0] ?? null
    }
    if (live.length === 1) {
      return live[0] ?? null
    }
    return null
  }
  if (live.length === 1) {
    return live[0] ?? null
  }
  const slotted = live.filter((fact) => fact.slot === kind)
  if (slotted.length === 1) {
    return slotted[0] ?? null
  }
  return null
}

export function nextGuestProposal(current: unknown, next: { submissionId: string, text: string, url: string | null }): GuestReportProposal {
  const previous = current && typeof current === 'object' && 'count' in current
    ? Number((current as { count: unknown }).count)
    : 0
  const count = Number.isFinite(previous) && previous > 0 ? previous + 1 : 1
  return {
    submissionId: next.submissionId,
    text: next.text,
    url: next.url,
    count,
  }
}

export function guestReportText(value: string, note: string) {
  const main = value.trim()
  const extra = note.trim()
  if (!extra) {
    return main
  }
  return `${main}. ${extra}`
}
