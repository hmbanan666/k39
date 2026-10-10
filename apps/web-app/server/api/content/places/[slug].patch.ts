import { db } from '@k39/database'
import { slugError } from '../../../../shared/seo'
import { requireContentToken } from '../../../utils/access'

export default defineEventHandler(async (event) => {
  requireContentToken(event)
  const slug = String(getRouterParam(event, 'slug'))
  const current = await db.editor.placeBySlug(slug)
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Место не найдено' })
  }
  const body = await readBody(event)
  if (current.publicationStatus === 'published' || body.publicationStatus === 'published') {
    throw createError({ statusCode: 409, statusMessage: 'API не меняет опубликованные страницы' })
  }
  const nextSlug = body.slug ? String(body.slug) : current.slug
  const problem = slugError(nextSlug)
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
  return db.editor.savePlace({
    id: current.id,
    slug: nextSlug,
    title: body.title ?? current.title,
    summary: body.summary ?? current.summary,
    body: body.body ?? current.body,
    status: body.status ?? current.status,
    hours: body.hours ?? current.hours,
    price: body.price ?? current.price,
    howToGet: body.howToGet ?? current.howToGet,
    latitude: body.latitude ?? current.latitude,
    longitude: body.longitude ?? current.longitude,
    categoryId: current.categoryId,
    regionId: current.regionId,
    sources: Array.isArray(body.sources) ? body.sources : current.sources,
    seoTitle: body.seoTitle ?? current.seoTitle,
    seoDescription: body.seoDescription ?? current.seoDescription,
    ogImage: body.ogImage ?? current.ogImage,
    publicationStatus: body.publicationStatus === 'review' ? 'review' : 'draft',
    noindex: body.noindex ?? current.noindex,
    authorKind: current.authorKind,
  })
})
