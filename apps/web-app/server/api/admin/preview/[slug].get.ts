import { db } from '@k39/database'
import { renderMarkdown } from '../../../../shared/markdown'
import { placeDocument } from '../../../../shared/seo'
import { requireEditor } from '../../../utils/access'
import { loadSchedule } from '../../../utils/schedule'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const slug = String(getRouterParam(event, 'slug') || '')
  const place = await db.editor.placeBySlug(slug)
  if (!place) {
    throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' })
  }
  const categories = await db.content.categories()
  const category = categories.find((item) => item.id === place.categoryId)
  const doc = placeDocument({
    slug: place.slug,
    title: place.title,
    summary: place.summary,
    categorySlug: category?.slug || 'preview',
    categoryTitle: category?.title || 'Черновик',
    schemaType: place.schemaType,
    regionTitle: null,
    latitude: place.latitude,
    longitude: place.longitude,
    phone: place.phone,
    website: place.website,
    hours: place.hours,
    schedule: await loadSchedule('place', place.id),
    seoTitle: place.seoTitle,
    seoDescription: place.seoDescription,
    noindex: true,
    sources: place.sources ?? [],
  })
  return {
    doc,
    html: renderMarkdown(place.body),
  }
})
