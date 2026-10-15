import { createError } from 'h3'
import { writingHits } from '../../../shared/writing'

/**
 * Draft and review saves return the messages and still store the row.
 * A published result, including a hub write, throws 400 before the write.
 */
export function writingGate(text: string, publishing: boolean, venue = false) {
  const writingWarnings = writingHits(text, { venue }).map((hit) => `${hit.phrase}: ${hit.match}`)
  if (publishing && writingWarnings.length) {
    throw createError({
      statusCode: 400,
      statusMessage: `Нельзя опубликовать: ${writingWarnings.join('; ')}`,
    })
  }
  return writingWarnings
}
