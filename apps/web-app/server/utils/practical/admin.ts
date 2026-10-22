import type { H3Event } from 'h3'
import type { PracticalSubjectType } from './target'
import { createError, getRouterParam } from 'h3'
import { requireEditor } from '../access'
import { practicalTarget } from './target'

const TYPES = new Set<PracticalSubjectType>(['place', 'venue', 'route'])

/** The admin subject from `/api/admin/practical/{type}/{id}`. Editors only. */
export async function adminPracticalTarget(event: H3Event) {
  await requireEditor(event)
  const type = getRouterParam(event, 'type') as PracticalSubjectType
  if (!TYPES.has(type)) {
    throw createError({ statusCode: 404, statusMessage: 'Неизвестный тип' })
  }
  return practicalTarget(type, getRouterParam(event, 'id'))
}
