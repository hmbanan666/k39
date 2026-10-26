/**
 * Shared pending-draft helpers for places, routes, and collections.
 * A draft-token write against a live row merges into one `content_drafts`
 * payload. An editor publish with no other fields applies that payload.
 */

export function mergedField<T>(input: T | undefined, base: Record<string, unknown>, key: string, fallback: T): T {
  if (input !== undefined) {
    return input
  }
  if (Object.hasOwn(base, key)) {
    return base[key] as T
  }
  return fallback
}

/** A value that is stored only when this write, or an earlier pending write, sent it. */
export function mergedPresent<T>(
  input: T | undefined,
  base: Record<string, unknown>,
  key: string,
): { set: true; value: T } | { set: false } {
  if (input !== undefined) {
    return { set: true, value: input }
  }
  if (Object.hasOwn(base, key)) {
    return { set: true, value: base[key] as T }
  }
  return { set: false }
}

/**
 * True when the write only names the row and a publication status.
 * A slug that still names this row is an address, not an edit.
 */
export function isPublicationOnly(input: object, keys: readonly string[], currentSlug: string) {
  const record = input as Record<string, unknown>
  if (record.slug !== undefined && record.slug !== currentSlug) {
    return false
  }
  return keys.every((key) => record[key] === undefined)
}

export function pendingPublication(requested: string | undefined): 'draft' | 'review' {
  return requested === 'draft' ? 'draft' : 'review'
}

export function pendingDraftFields(
  body: string,
  pendingStatus: 'draft' | 'review',
  renderedFields: readonly string[],
  writingWarnings: string[],
) {
  return {
    pendingReview: true as const,
    pendingPublicationStatus: pendingStatus,
    bodyLength: body.length,
    renderedFields,
    writingWarnings,
  }
}
