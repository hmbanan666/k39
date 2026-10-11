import { db } from '@k39/database'
import { requireContentToken } from '../../../utils/access'
import { updatePlaceDraft } from '../../../utils/mcp/places'

export default defineEventHandler(async (event) => {
  requireContentToken(event)
  const slug = String(getRouterParam(event, 'slug'))
  const current = await db.editor.placeBySlug(slug)
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Место не найдено' })
  }
  const body = await readBody(event)
  return updatePlaceDraft({
    id: current.id,
    slug: body.slug ? String(body.slug) : current.slug,
    title: body.title,
    categorySlug: body.categorySlug,
    status: body.status,
    publicationStatus: body.publicationStatus,
    summary: body.summary,
    body: body.body,
    hours: body.hours,
    price: body.price,
    howToGet: body.howToGet,
    latitude: body.latitude,
    longitude: body.longitude,
    seoTitle: body.seoTitle,
    seoDescription: body.seoDescription,
    ogImage: body.ogImage,
    noindex: body.noindex,
    sources: Array.isArray(body.sources) ? body.sources : undefined,
  })
})
