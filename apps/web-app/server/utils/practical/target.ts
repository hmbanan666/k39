import type { OwnSocialLinks } from './sources'
import { db } from '@k39/database'
import { createError } from 'h3'
import { refuseDraftLivePage } from '../mcp/draft'

export type PracticalSubjectType = 'place' | 'venue' | 'route'

export interface PracticalTarget<T extends PracticalSubjectType = PracticalSubjectType> {
  type: T
  id: string
  slug: string
  title: string
  status: string
  /** The subject's own social links. Only a venue has them. */
  own: OwnSocialLinks | null
}

const LIVE: Record<PracticalSubjectType, readonly string[]> = {
  place: ['published', 'archived'],
  venue: ['published', 'closed', 'archived'],
  route: ['published', 'archived'],
}

/** Resolves the owner of admission rows, events, or notices by id or slug. */
export async function practicalTarget<T extends PracticalSubjectType>(type: T, id?: string | null, slug?: string | null): Promise<PracticalTarget<T>> {
  if (!id && !slug) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен id или slug' })
  }
  if (type === 'place') {
    const row = id ? await db.editor.placeById(id) : await db.editor.placeBySlug(slug || '')
    if (row) {
      return { type, id: row.id, slug: row.slug, title: row.title, status: row.publicationStatus, own: null }
    }
  } else if (type === 'venue') {
    const row = id ? await db.venues.byId(id) : await db.venues.bySlug(slug || '')
    if (row) {
      return { type, id: row.id, slug: row.slug, title: row.name, status: row.status, own: { socials: row.socials, vkCommunityId: row.vkCommunityId } }
    }
  } else {
    const row = id ? await db.editor.routeById(id) : await db.editor.routeBySlug(slug || '')
    if (row) {
      return { type, id: row.id, slug: row.slug, title: row.title, status: row.publicationStatus, own: null }
    }
  }
  throw createError({ statusCode: 404, statusMessage: 'Объект не найден' })
}

export function isLivePractical(target: Pick<PracticalTarget, 'type' | 'status'>) {
  return LIVE[target.type].includes(target.status)
}

/** Draft token on a live parent: 409, and nothing is stored as a pending draft. */
export function refuseDraftLivePractical(target: Pick<PracticalTarget, 'type' | 'status'>, what: string) {
  refuseDraftLivePage(`edit ${what} of a published ${target.type}`, target.status, LIVE[target.type])
}
