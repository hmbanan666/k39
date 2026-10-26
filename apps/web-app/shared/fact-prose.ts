// Venue prose is not a second copy of the phone or the schedule (ADR 0033).

const PHONE = /(?:\+7|8)(?:[\s().-]*\d){10}/

/** Digits of each phone written in the text. `+7` and a leading `8` both count. */
export function phoneNumbers(text: string) {
  return [...text.matchAll(new RegExp(PHONE.source, 'g'))].map((match) => match[0].replace(/\D/g, ''))
}

function clocks(text: string) {
  return [...text.matchAll(/\b(\d{1,2})[:.](\d{2})\b/g)].map((match) => `${match[1]!.padStart(2, '0')}:${match[2]}`)
}

/** True when the prose contains both ends of a schedule line, such as 10:00 and 22:00. */
export function proseRepeatsHours(text: string, hourLines: string[]) {
  const found = new Set(clocks(text))
  if (found.size < 2) {
    return false
  }
  return hourLines.some((line) => {
    const pair = clocks(line)
    return pair.length >= 2 && pair.every((clock) => found.has(clock))
  })
}

export function repeatedKinds(text: string, hourLines: string[]) {
  const kinds: Array<'hours' | 'phone'> = []
  if (phoneNumbers(text).length) {
    kinds.push('phone')
  }
  if (proseRepeatsHours(text, hourLines)) {
    kinds.push('hours')
  }
  return kinds
}

function keepSentence(sentence: string, hourLines: string[]) {
  const trimmed = sentence.trim()
  if (!trimmed) {
    return false
  }
  if (phoneNumbers(trimmed).length) {
    return false
  }
  return !(hourLines.length && trimmed.length <= 180 && proseRepeatsHours(trimmed, hourLines))
}

/**
 * Public venue prose. Phone sentences are dropped: the page shows the one
 * phone fact. A short sentence that repeats the schedule is dropped too.
 */
export function publicProse(text: string, hourLines: string[]) {
  return text
    .split(/(\n+)/)
    .map((chunk) => {
      if (/^\n+$/.test(chunk)) {
        return chunk
      }
      return chunk
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => keepSentence(sentence, hourLines))
        .join(' ')
    })
    .join('')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** The same cut, applied to stored venue modules before they render. */
export function publicVenueModules(modules: unknown, hourLines: string[]) {
  if (!Array.isArray(modules)) {
    return modules
  }
  return modules.flatMap((module) => {
    if (!module || typeof module !== 'object') {
      return [module]
    }
    const row = module as Record<string, unknown>
    if (typeof row.text === 'string') {
      const text = publicProse(row.text, hourLines)
      return text ? [{ ...row, text }] : []
    }
    if (row.type === 'practical' && Array.isArray(row.items)) {
      const items = row.items.filter((item) => {
        if (!item || typeof item !== 'object') {
          return true
        }
        const value = (item as { value?: unknown }).value
        return typeof value !== 'string' || phoneNumbers(value).length === 0
      })
      return items.length ? [{ ...row, items }] : []
    }
    if ((row.type === 'tips' || row.type === 'faq') && Array.isArray(row.items)) {
      const items = row.items.flatMap((item) => {
        if (typeof item === 'string') {
          const text = publicProse(item, hourLines)
          return text ? [text] : []
        }
        if (!item || typeof item !== 'object') {
          return [item]
        }
        const entry = item as { question?: unknown; answer?: unknown }
        if (typeof entry.answer !== 'string') {
          return [item]
        }
        const answer = publicProse(entry.answer, hourLines)
        return answer ? [{ ...entry, answer }] : []
      })
      return items.length ? [{ ...row, items }] : []
    }
    return [row]
  })
}
