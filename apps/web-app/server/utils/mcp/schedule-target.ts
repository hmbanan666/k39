import { db } from '@k39/database'
import { createError } from 'h3'

/** Resolves a place or venue by id or slug for the schedule tools. */
export async function scheduleTarget(entityType: 'place' | 'venue', id?: string, slug?: string) {
  if (!id && !slug) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен id или slug' })
  }
  const row = entityType === 'place'
    ? (id ? await db.editor.placeById(id) : await db.editor.placeBySlug(slug || ''))
    : (id ? await db.venues.byId(id) : await db.venues.bySlug(slug || ''))
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Объект не найден' })
  }
  return { id: row.id, slug: row.slug }
}
