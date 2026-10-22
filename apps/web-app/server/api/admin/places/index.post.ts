import { db } from '@k39/database'
import { slugError } from '../../../../shared/seo'
import { requireEditor } from '../../../utils/access'
import { contentGate, savePlaceContent } from '../../../utils/content/save'
import { syncCoordinates, syncPlaceStatus } from '../../../utils/facts/sync'

export default defineEventHandler(async (event) => {
  const user = await requireEditor(event)
  const body = await readJsonBody(event)
  const slug = String(body.slug || '')
  const problem = slugError(slug)
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
  const category = await db.content.categoryBySlug(String(body.categorySlug || 'forty'))
  const publicationStatus = body.publicationStatus || 'draft'
  const { row, writingWarnings } = await savePlaceContent({
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
    publicationStatus,
    noindex: Boolean(body.noindex),
    authorKind: body.authorKind || 'human',
  }, user.id, contentGate('place', {
    title: body.title,
    summary: body.summary,
    body: body.body,
    hours: body.hours,
    price: body.price,
    howToGet: body.howToGet,
    seoTitle: body.seoTitle,
    seoDescription: body.seoDescription,
    sources: body.sources,
  }, publicationStatus === 'published'))
  const status = body.status || 'unknown'
  await syncCoordinates({
    subjectType: 'place',
    subjectId: row.id,
    actor: 'editor',
    pageStatus: publicationStatus,
    latitude: body.latitude,
    longitude: body.longitude,
    previous: { latitude: null, longitude: null },
  })
  await syncPlaceStatus({
    placeId: row!.id,
    actor: 'editor',
    pageStatus: publicationStatus,
    status,
    previous: '',
  })
  return { ...row, writingWarnings }
})
