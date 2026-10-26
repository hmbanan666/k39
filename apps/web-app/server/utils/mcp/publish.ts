import { db } from '@k39/database'
import { createError } from 'h3'
import { saveQuestContent } from '../content/save'
import { practicalTarget } from '../practical/target'
import { applyPendingVenue } from '../venues/pending'
import { auditMcp } from './audit'
import { saveCollectionDraft } from './collections'
import { refusePendingLiveEdit, resolvePublication } from './draft'
import { updatePlaceDraft } from './places'
import { updateRouteDraft } from './routes'

type PublicationInput = {
  id?: string
  slug?: string
  publicationStatus: string
}

type PublicationEntity = 'place' | 'route' | 'collection' | 'quest' | 'venue'

type QuestPublication = { id: string; slug: string; publicationStatus: string; writingWarnings: string[] }

type VenuePublication = Awaited<ReturnType<typeof applyVenueDraft>>

type AnyPublication =
  | Awaited<ReturnType<typeof updatePlaceDraft>>
  | Awaited<ReturnType<typeof updateRouteDraft>>
  | Awaited<ReturnType<typeof saveCollectionDraft>>
  | QuestPublication
  | VenuePublication

export function setPublication(input: { entity: 'place' } & PublicationInput): ReturnType<typeof updatePlaceDraft>
export function setPublication(input: { entity: 'route' } & PublicationInput): ReturnType<typeof updateRouteDraft>
export function setPublication(
  input: { entity: 'collection' } & PublicationInput,
): ReturnType<typeof saveCollectionDraft>
export function setPublication(input: { entity: 'quest' } & PublicationInput): Promise<QuestPublication>
export function setPublication(input: { entity: 'venue' } & PublicationInput): Promise<VenuePublication>
export function setPublication(input: { entity: PublicationEntity } & PublicationInput): Promise<AnyPublication>
export async function setPublication(input: { entity: PublicationEntity } & PublicationInput): Promise<AnyPublication> {
  if (input.entity === 'place') {
    return updatePlaceDraft(
      { id: input.id, slug: input.slug, publicationStatus: input.publicationStatus },
      'content_set_publication',
    )
  }
  if (input.entity === 'route') {
    return updateRouteDraft(
      { id: input.id, slug: input.slug, publicationStatus: input.publicationStatus },
      'content_set_publication',
    )
  }
  if (input.entity === 'venue') {
    return applyVenueDraft(input)
  }
  if (input.entity === 'collection') {
    return saveCollectionDraft(
      { id: input.id, slug: input.slug, publicationStatus: input.publicationStatus },
      'content_set_publication',
      { create: false },
    )
  }
  const current = input.id
    ? await db.editor.questById(input.id)
    : input.slug
      ? await db.editor.questBySlug(input.slug)
      : null
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Квест не найден' })
  }
  const publicationStatus = resolvePublication(input.publicationStatus, current.publicationStatus)
  refusePendingLiveEdit(publicationStatus, 'quest')
  const { row, writingWarnings } = await saveQuestContent(
    {
      id: current.id,
      slug: current.slug,
      title: current.title,
      summary: current.summary,
      body: current.body,
      publicationStatus,
      seoTitle: current.seoTitle,
      seoDescription: current.seoDescription,
      ogImage: current.ogImage,
      noindex: current.noindex,
      routeId: current.routeId,
    },
    null,
    {
      prose: [current.title, current.summary, current.body, current.seoTitle, current.seoDescription],
      publishing: publicationStatus === 'published',
    },
  )
  await auditMcp('content_set_publication', 'quest', current.id)
  return { id: row.id, slug: row.slug, publicationStatus: row.publicationStatus, writingWarnings }
}

/**
 * Editor apply of a venue's pending draft (ADR 0047, ADR 0049). Only
 * `published` with no other fields. The venue status is not changed: a
 * closed venue stays closed.
 */
async function applyVenueDraft(input: PublicationInput) {
  const target = await practicalTarget('venue', input.id, input.slug)
  if (input.publicationStatus !== 'published') {
    throw createError({ statusCode: 400, statusMessage: 'Для заведения применяется только published' })
  }
  resolvePublication(input.publicationStatus, target.status)
  const result = await applyPendingVenue(target.id)
  await auditMcp('content_set_publication', 'venue', target.id)
  return result
}
