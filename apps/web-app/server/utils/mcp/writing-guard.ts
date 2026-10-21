import { createError } from 'h3'
import { bannedSiteHits, bannedSiteProblem, writingHits } from '../../../shared/writing'

/**
 * Draft and review saves return the messages and still store the row.
 * A published result, including a hub write, throws 400 before the write.
 * Stylistic rules read `prose` only. Banned sites read prose and names.
 */
export function writingGate(input: { prose: string, names?: string, publishing: boolean, venue?: boolean }) {
  const style = writingHits(input.prose, { venue: input.venue })
  const banned = bannedSiteHits([input.prose, input.names ?? ''].filter(Boolean).join('\n'))
  const seen = new Set<string>()
  const writingWarnings: string[] = []
  for (const hit of [...style, ...banned]) {
    const key = `${hit.phrase}\0${hit.match}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    writingWarnings.push(`${hit.phrase}: ${hit.match}`)
  }
  if (input.publishing && writingWarnings.length) {
    throw createError({
      statusCode: 400,
      statusMessage: `Нельзя опубликовать: ${writingWarnings.join('; ')}`,
    })
  }
  return writingWarnings
}

/** Banned sites are rejected on every save, including a draft. */
export function rejectBannedSites(value: unknown) {
  const problem = bannedSiteProblem(value)
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
}
