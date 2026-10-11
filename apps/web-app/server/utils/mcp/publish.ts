import { db } from '@k39/database'
import { auditMcp } from './audit'
import { normalizePublication } from './draft'
import { updatePlaceDraft } from './places'

export async function setPublication(input: {
  entity: 'place' | 'route' | 'collection' | 'quest'
  id?: string
  slug?: string
  publicationStatus: string
}) {
  const publicationStatus = normalizePublication(input.publicationStatus)
  if (input.entity === 'place') {
    return updatePlaceDraft({ id: input.id, slug: input.slug, publicationStatus }, 'content_set_publication')
  }
  if (input.entity === 'route') {
    const rows = await db.editor.listRoutes()
    const current = rows.find((item) => item.id === input.id || item.slug === input.slug)
    if (!current) {
      throw createError({ statusCode: 404, statusMessage: 'Маршрут не найден' })
    }
    const row = await db.editor.saveRoute({
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
    })
    await auditMcp('content_set_publication', 'route', current.id)
    return { id: row?.id, slug: row?.slug, publicationStatus: row?.publicationStatus }
  }
  if (input.entity === 'collection') {
    const rows = await db.editor.listCollections()
    const current = rows.find((item) => item.id === input.id || item.slug === input.slug)
    if (!current) {
      throw createError({ statusCode: 404, statusMessage: 'Подборка не найдена' })
    }
    const row = await db.editor.saveCollection({
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
    })
    await auditMcp('content_set_publication', 'collection', current.id)
    return { id: row?.id, slug: row?.slug, publicationStatus: row?.publicationStatus }
  }
  const current = input.id
    ? await db.editor.questById(input.id)
    : input.slug
      ? await db.editor.questBySlug(input.slug)
      : null
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Квест не найден' })
  }
  const row = await db.editor.saveQuest({
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
  })
  await auditMcp('content_set_publication', 'quest', current.id)
  return { id: row.id, slug: row.slug, publicationStatus: row.publicationStatus }
}
