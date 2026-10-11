import type { VisitStatus } from '@k39/database'
import { db } from '@k39/database'
import { slugError } from '../../../shared/seo'
import { auditMcp } from './audit'
import { normalizePublication } from './draft'

const VISIT = new Set(['open', 'ruins', 'closed', 'unknown'])

export interface PlaceDraftInput {
  id?: string
  slug?: string
  title?: string
  categorySlug?: string
  status?: string
  publicationStatus?: string
  summary?: string
  body?: string
  hours?: string | null
  price?: string | null
  howToGet?: string | null
  latitude?: number | null
  longitude?: number | null
  seoTitle?: string | null
  seoDescription?: string | null
  ogImage?: string | null
  noindex?: boolean
  sources?: Array<{ title: string, url: string }>
}

function compactPlace(row: {
  id: string
  slug: string
  title: string
  publicationStatus: string
  status: string
  updatedAt?: string
}) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    publicationStatus: row.publicationStatus,
    updatedAt: row.updatedAt,
  }
}

async function categoryId(slug: string | undefined, fallback: string | null) {
  if (!slug) {
    return fallback
  }
  const category = await db.content.categoryBySlug(slug)
  if (!category) {
    throw createError({ statusCode: 400, statusMessage: 'Раздел не найден' })
  }
  return category.id
}

export async function createPlaceDraft(input: PlaceDraftInput) {
  const publicationStatus = normalizePublication(input.publicationStatus)
  const slug = String(input.slug || '')
  const problem = slugError(slug)
  if (problem || !input.title?.trim()) {
    throw createError({ statusCode: 400, statusMessage: problem || 'Нужны название и адрес' })
  }
  const row = await db.editor.savePlace({
    slug,
    title: input.title.trim(),
    summary: input.summary || '',
    body: input.body || '',
    status: (VISIT.has(input.status || '') ? input.status : 'unknown') as VisitStatus,
    hours: input.hours || null,
    price: input.price || null,
    howToGet: input.howToGet || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    categoryId: await categoryId(input.categorySlug || 'forty', null),
    sources: input.sources || [],
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
    ogImage: input.ogImage || null,
    publicationStatus,
    noindex: Boolean(input.noindex),
    authorKind: 'ai',
  })
  await auditMcp('place_draft_create', 'place', row?.id)
  return compactPlace(row!)
}

export async function updatePlaceDraft(input: PlaceDraftInput, auditTool = 'place_draft_update') {
  const current = input.id
    ? await db.editor.placeById(input.id)
    : input.slug
      ? await db.editor.placeBySlug(input.slug)
      : null
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Место не найдено' })
  }
  const publicationStatus = normalizePublication(input.publicationStatus, current.publicationStatus)
  const slug = input.slug || current.slug
  const problem = slugError(slug)
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
  const row = await db.editor.savePlace({
    id: current.id,
    slug,
    title: input.title ?? current.title,
    summary: input.summary ?? current.summary,
    body: input.body ?? current.body,
    status: (input.status && VISIT.has(input.status) ? input.status : current.status) as VisitStatus,
    hours: input.hours === undefined ? current.hours : input.hours,
    price: input.price === undefined ? current.price : input.price,
    howToGet: input.howToGet === undefined ? current.howToGet : input.howToGet,
    latitude: input.latitude === undefined ? current.latitude : input.latitude,
    longitude: input.longitude === undefined ? current.longitude : input.longitude,
    categoryId: await categoryId(input.categorySlug, current.categoryId),
    regionId: current.regionId,
    sources: input.sources ?? current.sources ?? [],
    seoTitle: input.seoTitle === undefined ? current.seoTitle : input.seoTitle,
    seoDescription: input.seoDescription === undefined ? current.seoDescription : input.seoDescription,
    ogImage: input.ogImage === undefined ? current.ogImage : input.ogImage,
    publicationStatus,
    noindex: input.noindex ?? current.noindex,
    authorKind: current.authorKind,
  })
  await auditMcp(auditTool, 'place', current.id)
  return compactPlace(row!)
}

export async function submitPlaceReview(input: { id?: string, slug?: string }) {
  const current = input.id
    ? await db.editor.placeById(input.id)
    : input.slug
      ? await db.editor.placeBySlug(input.slug)
      : null
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Место не найдено' })
  }
  const row = await db.editor.savePlace({
    id: current.id,
    slug: current.slug,
    title: current.title,
    summary: current.summary,
    body: current.body,
    status: current.status,
    hours: current.hours,
    price: current.price,
    howToGet: current.howToGet,
    latitude: current.latitude,
    longitude: current.longitude,
    categoryId: current.categoryId,
    regionId: current.regionId,
    sources: current.sources ?? [],
    seoTitle: current.seoTitle,
    seoDescription: current.seoDescription,
    ogImage: current.ogImage,
    noindex: current.noindex,
    publicationStatus: 'review',
    authorKind: current.authorKind,
  })
  await auditMcp('place_submit_review', 'place', current.id)
  return compactPlace(row!)
}
