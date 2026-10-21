import { db } from '@k39/database'
import { saveQuestContent } from '../content/save'
import { auditMcp } from './audit'
import { saveCollectionDraft } from './collections'
import { refusePendingLiveEdit, resolvePublication } from './draft'
import { updatePlaceDraft } from './places'
import { updateRouteDraft } from './routes'

export async function setPublication(input: {
  entity: 'place' | 'route' | 'collection' | 'quest'
  id?: string
  slug?: string
  publicationStatus: string
}) {
  if (input.entity === 'place') {
    return updatePlaceDraft({ id: input.id, slug: input.slug, publicationStatus: input.publicationStatus }, 'content_set_publication')
  }
  if (input.entity === 'route') {
    return updateRouteDraft({ id: input.id, slug: input.slug, publicationStatus: input.publicationStatus }, 'content_set_publication')
  }
  if (input.entity === 'collection') {
    return saveCollectionDraft({ id: input.id, slug: input.slug, publicationStatus: input.publicationStatus }, 'content_set_publication', { create: false })
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
  const { row, writingWarnings } = await saveQuestContent({
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
  }, null, {
    prose: [current.title, current.summary, current.body, current.seoTitle, current.seoDescription],
    publishing: publicationStatus === 'published',
  })
  await auditMcp('content_set_publication', 'quest', current.id)
  return { id: row.id, slug: row.slug, publicationStatus: row.publicationStatus, writingWarnings }
}
