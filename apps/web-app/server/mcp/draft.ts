import { createError } from 'h3'

export function draftStatus(requested: string | undefined, current?: string | null): 'draft' | 'review' {
  if (current === 'published' || requested === 'published') {
    throw createError({
      statusCode: current === 'published' ? 409 : 400,
      statusMessage: 'API не публикует страницы',
    })
  }
  if (requested === 'review') {
    return 'review'
  }
  if (requested === 'draft') {
    return 'draft'
  }
  return current === 'review' ? 'review' : 'draft'
}
