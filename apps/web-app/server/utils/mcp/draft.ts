import type { ContentScope } from '../access'
import { createError } from 'h3'
import { contentScope } from '../access'

const STATUSES = new Set(['draft', 'review', 'published'])

export function normalizePublication(requested: string | undefined, current?: string | null): 'draft' | 'review' | 'published' | 'archived' {
  if (requested) {
    if (!STATUSES.has(requested)) {
      throw createError({ statusCode: 400, statusMessage: 'Неизвестный статус публикации' })
    }
    return requested as 'draft' | 'review' | 'published'
  }
  if (current === 'published' || current === 'review' || current === 'draft' || current === 'archived') {
    return current
  }
  return 'draft'
}

export type ResolvedPublication = 'draft' | 'review' | 'published' | 'archived' | 'pending'

/**
 * Editor scope keeps the admin statuses.
 * Draft scope never returns published. A write against a live row is `pending`:
 * the caller stores a review draft and leaves the published row alone.
 */
export function resolvePublication(requested: string | undefined, current?: string | null, scope: ContentScope = contentScope()): ResolvedPublication {
  if (scope !== 'draft') {
    return normalizePublication(requested, current)
  }
  if (requested === 'published') {
    throw createError({ statusCode: 403, statusMessage: 'Draft token cannot publish' })
  }
  if (requested && !STATUSES.has(requested)) {
    throw createError({ statusCode: 400, statusMessage: 'Неизвестный статус публикации' })
  }
  if (current === 'published' || current === 'archived') {
    return 'pending'
  }
  if (requested === 'review' || requested === 'draft') {
    return requested
  }
  if (current === 'review' || current === 'draft') {
    return current
  }
  return 'draft'
}

export function refusePendingLiveEdit(status: ResolvedPublication, label: string): asserts status is Exclude<ResolvedPublication, 'pending'> {
  if (status === 'pending') {
    throw createError({
      statusCode: 409,
      statusMessage: `Draft token cannot edit a published ${label}. The live page was not changed.`,
    })
  }
}
