import { db } from '@k39/database'
import { collectionWritePlan } from '../../../shared/page-modules'
import { contentGate, saveCollectionContent, saveQuestContent, saveRouteContent } from '../content/save'
import { auditMcp } from './audit'
import { refusePendingLiveEdit, resolvePublication } from './draft'
import { updatePlaceDraft } from './places'

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
    const rows = await db.editor.listRoutes()
    const current = rows.find((item) => item.id === input.id || item.slug === input.slug)
    if (!current) {
      throw createError({ statusCode: 404, statusMessage: 'Маршрут не найден' })
    }
    const publicationStatus = resolvePublication(input.publicationStatus, current.publicationStatus)
    refusePendingLiveEdit(publicationStatus, 'route')
    const { row, writingWarnings } = await saveRouteContent({
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
    }, null, contentGate('route', {
      title: current.title,
      summary: current.summary,
      body: current.body,
      seoTitle: current.seoTitle,
      seoDescription: current.seoDescription,
    }, publicationStatus === 'published'))
    await auditMcp('content_set_publication', 'route', current.id)
    return { id: row?.id, slug: row?.slug, publicationStatus: row?.publicationStatus, writingWarnings }
  }
  if (input.entity === 'collection') {
    const rows = await db.editor.listCollections()
    const current = rows.find((item) => item.id === input.id || item.slug === input.slug)
    if (!current) {
      throw createError({ statusCode: 404, statusMessage: 'Подборка не найдена' })
    }
    const publicationStatus = resolvePublication(input.publicationStatus, current.publicationStatus)
    refusePendingLiveEdit(publicationStatus, 'collection')
    const plan = collectionWritePlan({
      sentBody: undefined,
      currentBody: current.body,
      modules: current.modules,
    })
    const { row, writingWarnings } = await saveCollectionContent({
      id: current.id,
      slug: current.slug,
      title: current.title,
      summary: current.summary,
      body: plan.body,
      publicationStatus,
      seoTitle: current.seoTitle,
      seoDescription: current.seoDescription,
      ogImage: current.ogImage,
      noindex: current.noindex,
    }, null, contentGate('collection', {
      title: current.title,
      summary: current.summary,
      copy: plan.copy,
      seoTitle: current.seoTitle,
      seoDescription: current.seoDescription,
      sources: current.sources,
    }, publicationStatus === 'published'))
    await auditMcp('content_set_publication', 'collection', current.id)
    return {
      id: row?.id,
      slug: row?.slug,
      publicationStatus: row?.publicationStatus,
      article: plan.article,
      renderedFields: plan.renderedFields,
      writingWarnings,
    }
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
