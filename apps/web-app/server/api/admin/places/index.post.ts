import { db } from '@k39/database'
import { slugError } from '../../../../shared/seo'
import { requireEditor } from '../../../utils/access'

export default defineEventHandler(async (event) => {
  const user = await requireEditor(event)
  const body = await readBody(event)
  const slug = String(body.slug || '')
  const problem = slugError(slug)
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
  const category = await db.content.categoryBySlug(String(body.categorySlug || 'forty'))
  return db.editor.savePlace({
    slug,
    title: String(body.title || ''),
    summary: String(body.summary || ''),
    body: String(body.body || ''),
    status: body.status || 'unknown',
    hours: body.hours || null,
    price: body.price || null,
    howToGet: body.howToGet || null,
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    categoryId: category?.id ?? null,
    regionId: body.regionId || null,
    sources: Array.isArray(body.sources) ? body.sources : [],
    seoTitle: body.seoTitle || null,
    seoDescription: body.seoDescription || null,
    ogImage: body.ogImage || null,
    publicationStatus: body.publicationStatus || 'draft',
    noindex: Boolean(body.noindex),
    authorKind: body.authorKind || 'human',
  }, user.id)
})
