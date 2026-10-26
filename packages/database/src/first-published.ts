/**
 * First time a row became published (ADR 0045). Later edits keep that
 * instant so a goal window does not restart. A draft stays null.
 */
export function firstPublishedStamp(
  existing: string | null | undefined,
  nextStatus: string,
  now = new Date().toISOString(),
): string | null {
  if (existing) {
    return existing
  }
  if (nextStatus === 'published') {
    return now
  }
  return null
}
