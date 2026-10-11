import { createError } from 'h3'

const STATUSES = new Set(['draft', 'review', 'published'])

export function normalizePublication(requested: string | undefined, current?: string | null): 'draft' | 'review' | 'published' {
  if (requested) {
    if (!STATUSES.has(requested)) {
      throw createError({ statusCode: 400, statusMessage: 'Неизвестный статус публикации' })
    }
    return requested as 'draft' | 'review' | 'published'
  }
  if (current === 'published' || current === 'review' || current === 'draft') {
    return current
  }
  return 'draft'
}
