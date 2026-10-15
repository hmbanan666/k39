import { db } from '@k39/database'
import { slugError } from '../../../../shared/seo'
import { writingCopy } from '../../../../shared/writing'
import { requireEditor } from '../../../utils/access'
import { writingGate } from '../../../utils/mcp/writing-guard'

export default defineEventHandler(async (event) => {
  const user = await requireEditor(event)
  const id = String(getRouterParam(event, 'id'))
  const current = await db.editor.placeById(id)
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Место не найдено' })
  }
  const body = await readBody(event)
  const slug = String(body.slug || current.slug)
  const problem = slugError(slug)
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
  const category = body.categorySlug ? await db.content.categoryBySlug(String(body.categorySlug)) : null
  const publicationStatus = body.publicationStatus ?? current.publicationStatus
  const writingWarnings = writingGate(writingCopy([
    body.title ?? current.title,
    body.summary ?? current.summary,
    body.body ?? current.body,
    body.hours ?? current.hours,
    body.price ?? current.price,
    body.howToGet ?? current.howToGet,
    body.seoTitle ?? current.seoTitle,
    body.seoDescription ?? current.seoDescription,
  ]), publicationStatus === 'published')
  const row = await db.editor.savePlace({
    id,
    slug,
    title: String(body.title ?? current.title),
    summary: String(body.summary ?? current.summary),
    body: String(body.body ?? current.body),
    status: body.status ?? current.status,
    hours: body.hours ?? current.hours,
    price: body.price ?? current.price,
    howToGet: body.howToGet ?? current.howToGet,
    latitude: body.latitude ?? current.latitude,
    longitude: body.longitude ?? current.longitude,
    categoryId: category?.id ?? current.categoryId,
    regionId: body.regionId ?? current.regionId,
    sources: Array.isArray(body.sources) ? body.sources : current.sources,
    seoTitle: body.seoTitle ?? current.seoTitle,
    seoDescription: body.seoDescription ?? current.seoDescription,
    ogImage: body.ogImage ?? current.ogImage,
    publicationStatus,
    noindex: body.noindex ?? current.noindex,
    authorKind: body.authorKind ?? current.authorKind,
  }, user.id)
  return { ...row, writingWarnings }
})
