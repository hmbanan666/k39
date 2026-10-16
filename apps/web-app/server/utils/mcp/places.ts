import type { VisitStatus } from '@k39/database'
import { db } from '@k39/database'
import { slugError } from '../../../shared/seo'
import { writingCopy } from '../../../shared/writing'
import { contentScope } from '../access'
import { syncPageSections } from '../facts/queue'
import { syncCoordinates, syncPlaceStatus } from '../facts/sync'
import { auditMcp } from './audit'
import { resolvePublication } from './draft'
import { parseFactsCheckedAt } from './facts'
import { writingGate } from './writing-guard'

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
  sections?: unknown[]
  hours?: string | null
  price?: string | null
  howToGet?: string | null
  latitude?: number | null
  longitude?: number | null
  regionSlug?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  ogImage?: string | null
  noindex?: boolean
  sources?: Array<{ title: string, url: string }>
  factsCheckedAt?: string | null
  visitDuration?: string | null
  bestTime?: string | null
  faq?: Array<{ question: string, answer: string }>
}

function cleanFaq(items: Array<{ question: string, answer: string }>) {
  return items
    .map((item) => ({ question: item.question.replace(/\s+/g, ' ').trim(), answer: item.answer.trim() }))
    .filter((item) => item.question && item.answer)
}

function cleanText(value: string | null | undefined) {
  const text = value?.replace(/\s+/g, ' ').trim()
  return text || null
}

function compactPlace(row: {
  id: string
  slug: string
  title: string
  publicationStatus: string
  status: string
  updatedAt?: string
  lastVerifiedAt?: string | null
}) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    publicationStatus: row.publicationStatus,
    updatedAt: row.updatedAt,
    factsCheckedAt: row.lastVerifiedAt ?? null,
  }
}

async function regionIdOf(slug: string | null | undefined, fallback: string | null) {
  if (slug === undefined) {
    return fallback
  }
  if (!slug) {
    return null
  }
  const region = (await db.editor.listRegions()).find((item) => item.slug === slug)
  if (!region) {
    throw createError({ statusCode: 400, statusMessage: 'Регион не найден' })
  }
  return region.id
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

function statusOnly(input: PlaceDraftInput) {
  return input.title === undefined
    && input.summary === undefined
    && input.body === undefined
    && input.sections === undefined
    && input.hours === undefined
    && input.price === undefined
    && input.howToGet === undefined
    && input.latitude === undefined
    && input.longitude === undefined
    && input.regionSlug === undefined
    && input.categorySlug === undefined
    && input.seoTitle === undefined
    && input.seoDescription === undefined
    && input.ogImage === undefined
    && input.noindex === undefined
    && input.sources === undefined
    && input.visitDuration === undefined
    && input.bestTime === undefined
    && input.faq === undefined
    && input.factsCheckedAt === undefined
    && input.status === undefined
    && input.slug === undefined
}

export function placeWriteFromBody(body: Record<string, unknown>, current: { id: string, slug: string }): PlaceDraftInput {
  return {
    id: current.id,
    slug: typeof body.slug === 'string' && body.slug ? body.slug : current.slug,
    title: body.title as string | undefined,
    categorySlug: body.categorySlug as string | undefined,
    status: body.status as string | undefined,
    publicationStatus: body.publicationStatus as string | undefined,
    summary: body.summary as string | undefined,
    body: body.body as string | undefined,
    sections: Array.isArray(body.sections) ? body.sections : undefined,
    hours: body.hours as string | null | undefined,
    price: body.price as string | null | undefined,
    howToGet: body.howToGet as string | null | undefined,
    latitude: body.latitude as number | null | undefined,
    longitude: body.longitude as number | null | undefined,
    regionSlug: body.regionSlug as string | null | undefined,
    seoTitle: body.seoTitle as string | null | undefined,
    seoDescription: body.seoDescription as string | null | undefined,
    ogImage: body.ogImage as string | null | undefined,
    noindex: body.noindex as boolean | undefined,
    sources: Array.isArray(body.sources) ? body.sources as PlaceDraftInput['sources'] : undefined,
    factsCheckedAt: body.factsCheckedAt as string | null | undefined,
    visitDuration: body.visitDuration as string | null | undefined,
    bestTime: body.bestTime as string | null | undefined,
    faq: Array.isArray(body.faq) ? body.faq as PlaceDraftInput['faq'] : undefined,
  }
}

export async function createPlaceDraft(input: PlaceDraftInput) {
  const publicationStatus = resolvePublication(input.publicationStatus)
  if (publicationStatus === 'pending' || publicationStatus === 'archived') {
    throw createError({ statusCode: 400, statusMessage: 'Неизвестный статус публикации' })
  }
  const slug = String(input.slug || '')
  const problem = slugError(slug)
  if (problem || !input.title?.trim()) {
    throw createError({ statusCode: 400, statusMessage: problem || 'Нужны название и адрес' })
  }
  const checked = parseFactsCheckedAt(input.factsCheckedAt)
  const writingWarnings = writingGate(writingCopy([
    input.title,
    input.summary,
    input.body,
    input.sections,
    input.hours,
    input.price,
    input.howToGet,
    input.seoTitle,
    input.seoDescription,
    input.visitDuration,
    input.bestTime,
    input.faq,
    input.sources,
  ]), publicationStatus === 'published')
  const status = (VISIT.has(input.status || '') ? input.status : 'unknown') as VisitStatus
  const row = await db.editor.savePlace({
    slug,
    title: input.title.trim(),
    summary: input.summary || '',
    body: input.body || '',
    ...(input.sections ? { sections: input.sections as never } : {}),
    status,
    hours: input.hours || null,
    price: input.price || null,
    howToGet: input.howToGet || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    categoryId: await categoryId(input.categorySlug || 'forty', null),
    regionId: await regionIdOf(input.regionSlug, null),
    sources: input.sources || [],
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
    ogImage: input.ogImage || null,
    publicationStatus,
    noindex: Boolean(input.noindex),
    authorKind: 'ai',
    visitDuration: cleanText(input.visitDuration),
    bestTime: cleanText(input.bestTime),
    faq: cleanFaq(input.faq ?? []),
    ...(checked !== undefined ? { lastVerifiedAt: checked } : {}),
  })
  await syncCoordinates({
    subjectType: 'place',
    subjectId: row!.id,
    actor: 'mcp',
    pageStatus: publicationStatus,
    latitude: input.latitude,
    longitude: input.longitude,
    previous: { latitude: null, longitude: null },
  })
  await syncPlaceStatus({
    placeId: row!.id,
    actor: 'mcp',
    pageStatus: publicationStatus,
    status,
    previous: '',
  })
  await syncPageSections('place', row!.id)
  await auditMcp('place_draft_create', 'place', row?.id)
  return { ...compactPlace(row!), writingWarnings }
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
  const scope = contentScope()
  const pending = await db.editor.contentDraft('place', current.id)
  const publicationStatus = resolvePublication(input.publicationStatus, current.publicationStatus, scope)
  if (scope === 'editor' && publicationStatus === 'published' && pending && statusOnly(input)) {
    const payload = pending.payload
    const row = await db.editor.savePlace({
      ...(payload as Parameters<typeof db.editor.savePlace>[0]),
      id: current.id,
      slug: String(payload.slug || current.slug),
      title: String(payload.title || current.title),
      publicationStatus: 'published',
    })
    await syncCoordinates({
      subjectType: 'place',
      subjectId: current.id,
      actor: 'mcp',
      pageStatus: 'published',
      latitude: row?.latitude,
      longitude: row?.longitude,
      previous: { latitude: current.latitude, longitude: current.longitude },
    })
    await syncPlaceStatus({
      placeId: current.id,
      actor: 'mcp',
      pageStatus: 'published',
      status: row?.status,
      previous: current.status,
    })
    await syncPageSections('place', current.id)
    await db.editor.deleteContentDraft('place', current.id)
    await auditMcp(auditTool, 'place', current.id)
    return { ...compactPlace(row!), pendingReview: false, writingWarnings: [] as string[] }
  }
  if (publicationStatus === 'pending') {
    const slug = input.slug || String(pending?.payload.slug || current.slug)
    const problem = slugError(slug)
    if (problem) {
      throw createError({ statusCode: 400, statusMessage: problem })
    }
    const base = pending?.payload ?? {}
    const text = (key: string, value: string | null | undefined, fallback: string | null) => {
      if (value !== undefined) {
        return value
      }
      if (key in base) {
        return (base[key] as string | null | undefined) ?? null
      }
      return fallback
    }
    const checked = parseFactsCheckedAt(
      input.factsCheckedAt === undefined
        ? (base.factsCheckedAt as string | null | undefined) ?? (base.lastVerifiedAt as string | null | undefined)
        : input.factsCheckedAt,
    )
    const pendingStatus = input.publicationStatus === 'draft' ? 'draft' : 'review'
    const payload = {
      slug,
      title: input.title ?? (base.title as string | undefined) ?? current.title,
      summary: input.summary ?? (base.summary as string | undefined) ?? current.summary,
      body: input.body ?? (base.body as string | undefined) ?? current.body,
      ...(input.sections ? { sections: input.sections } : base.sections ? { sections: base.sections } : {}),
      status: input.status && VISIT.has(input.status) ? input.status : (base.status as string | undefined) ?? current.status,
      hours: text('hours', input.hours, current.hours),
      price: text('price', input.price, current.price),
      howToGet: text('howToGet', input.howToGet, current.howToGet),
      latitude: input.latitude === undefined ? (base.latitude as number | null | undefined) ?? current.latitude : input.latitude,
      longitude: input.longitude === undefined ? (base.longitude as number | null | undefined) ?? current.longitude : input.longitude,
      categoryId: await categoryId(input.categorySlug, (base.categoryId as string | null | undefined) ?? current.categoryId),
      regionId: await regionIdOf(input.regionSlug, (base.regionId as string | null | undefined) ?? current.regionId),
      sources: input.sources ?? (base.sources as PlaceDraftInput['sources']) ?? current.sources ?? [],
      seoTitle: text('seoTitle', input.seoTitle, current.seoTitle),
      seoDescription: text('seoDescription', input.seoDescription, current.seoDescription),
      ogImage: text('ogImage', input.ogImage, current.ogImage),
      noindex: input.noindex ?? (base.noindex as boolean | undefined) ?? current.noindex,
      visitDuration: input.visitDuration === undefined
        ? (base.visitDuration as string | null | undefined) ?? current.visitDuration
        : cleanText(input.visitDuration),
      bestTime: input.bestTime === undefined
        ? (base.bestTime as string | null | undefined) ?? current.bestTime
        : cleanText(input.bestTime),
      faq: input.faq === undefined
        ? (base.faq as PlaceDraftInput['faq']) ?? current.faq
        : cleanFaq(input.faq),
      lastVerifiedAt: checked === undefined ? (base.lastVerifiedAt as string | null | undefined) ?? current.lastVerifiedAt : checked,
      authorKind: current.authorKind,
    }
    const writingWarnings = writingGate(writingCopy([
      payload.title,
      payload.summary,
      payload.body,
      payload.sections,
      payload.hours,
      payload.price,
      payload.howToGet,
      payload.seoTitle,
      payload.seoDescription,
      payload.visitDuration,
      payload.bestTime,
      payload.faq,
      payload.sources,
    ]), false)
    await db.editor.saveContentDraft({
      entityType: 'place',
      entityId: current.id,
      publicationStatus: pendingStatus,
      payload,
    })
    await auditMcp(auditTool, 'place', current.id)
    return {
      ...compactPlace(current),
      pendingReview: true,
      pendingPublicationStatus: pendingStatus,
      writingWarnings,
    }
  }
  const slug = input.slug || current.slug
  const problem = slugError(slug)
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
  const checked = parseFactsCheckedAt(input.factsCheckedAt)
  const writingWarnings = writingGate(writingCopy([
    input.title ?? current.title,
    input.summary ?? current.summary,
    input.body ?? current.body,
    input.sections,
    input.hours === undefined ? current.hours : input.hours,
    input.price === undefined ? current.price : input.price,
    input.howToGet === undefined ? current.howToGet : input.howToGet,
    input.seoTitle === undefined ? current.seoTitle : input.seoTitle,
    input.seoDescription === undefined ? current.seoDescription : input.seoDescription,
    input.visitDuration === undefined ? current.visitDuration : input.visitDuration,
    input.bestTime === undefined ? current.bestTime : input.bestTime,
    input.faq === undefined ? current.faq : input.faq,
    input.sources ?? current.sources,
  ]), publicationStatus === 'published')
  const status = (input.status && VISIT.has(input.status) ? input.status : current.status) as VisitStatus
  const point = await syncCoordinates({
    subjectType: 'place',
    subjectId: current.id,
    actor: 'mcp',
    pageStatus: publicationStatus,
    latitude: input.latitude,
    longitude: input.longitude,
    previous: { latitude: current.latitude, longitude: current.longitude },
  })
  const visit = await syncPlaceStatus({
    placeId: current.id,
    actor: 'mcp',
    pageStatus: publicationStatus,
    status: input.status && VISIT.has(input.status) ? input.status : undefined,
    previous: current.status,
  })
  const row = await db.editor.savePlace({
    id: current.id,
    slug,
    title: input.title ?? current.title,
    summary: input.summary ?? current.summary,
    body: input.body ?? current.body,
    ...(input.sections ? { sections: input.sections as never } : {}),
    status: visit.skipped ? current.status : status,
    hours: input.hours === undefined ? current.hours : input.hours,
    price: input.price === undefined ? current.price : input.price,
    howToGet: input.howToGet === undefined ? current.howToGet : input.howToGet,
    latitude: point.skipped || input.latitude === undefined ? current.latitude : input.latitude,
    longitude: point.skipped || input.longitude === undefined ? current.longitude : input.longitude,
    categoryId: await categoryId(input.categorySlug, current.categoryId),
    regionId: await regionIdOf(input.regionSlug, current.regionId),
    sources: input.sources ?? current.sources ?? [],
    seoTitle: input.seoTitle === undefined ? current.seoTitle : input.seoTitle,
    seoDescription: input.seoDescription === undefined ? current.seoDescription : input.seoDescription,
    ogImage: input.ogImage === undefined ? current.ogImage : input.ogImage,
    publicationStatus,
    noindex: input.noindex ?? current.noindex,
    authorKind: current.authorKind,
    visitDuration: input.visitDuration === undefined ? current.visitDuration : cleanText(input.visitDuration),
    bestTime: input.bestTime === undefined ? current.bestTime : cleanText(input.bestTime),
    faq: input.faq === undefined ? current.faq : cleanFaq(input.faq),
    lastVerifiedAt: checked === undefined ? current.lastVerifiedAt : checked,
  })
  await syncPageSections('place', current.id)
  if (scope === 'editor') {
    await db.editor.deleteContentDraft('place', current.id)
  }
  await auditMcp(auditTool, 'place', current.id)
  return { ...compactPlace(row!), pendingReview: false, writingWarnings }
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
  if (contentScope() === 'draft' && (current.publicationStatus === 'published' || current.publicationStatus === 'archived')) {
    return updatePlaceDraft({ id: current.id, publicationStatus: 'review' }, 'place_submit_review')
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
    lastVerifiedAt: current.lastVerifiedAt,
  })
  await auditMcp('place_submit_review', 'place', current.id)
  return compactPlace(row!)
}
