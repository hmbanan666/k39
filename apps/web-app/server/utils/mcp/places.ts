import type { ContentTx, VisitStatus } from '@k39/database'
import type { PlaceContactInput } from '../content/place-contact'
import { db } from '@k39/database'
import { slugError } from '../../../shared/seo'
import { contentScope } from '../access'
import { withEditorLiveWrite } from '../content/pending-guard'
import { phoneCheckedAt, placePhoneSource, resolvePlaceContact } from '../content/place-contact'
import { applyPendingPlaceContent, contentGate, savePendingDraftContent, savePlaceContent, syncSavedPage } from '../content/save'
import { syncCoordinates, syncPlacePhone, syncPlaceStatus } from '../facts/sync'
import { auditMcp } from './audit'
import { resolvePublication } from './draft'
import { parseFactsCheckedAt } from './facts'
import { isPublicationOnly, mergedField, pendingDraftFields, pendingPublication } from './pending'

const VISIT = new Set(['open', 'ruins', 'closed', 'unknown'])

export interface PlaceDraftInput extends PlaceContactInput {
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
  phone?: string | null
  website?: string | null
  schemaType?: string | null
}) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    publicationStatus: row.publicationStatus,
    updatedAt: row.updatedAt,
    factsCheckedAt: row.lastVerifiedAt ?? null,
    phone: row.phone ?? null,
    website: row.website ?? null,
    schemaType: row.schemaType ?? null,
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

/** Fields the public place page shows. `body` is the article. */
const PLACE_RENDERED_FIELDS = [
  'title',
  'summary',
  'body',
  'visitDuration',
  'bestTime',
  'hours',
  'price',
  'phone',
  'website',
  'howToGet',
  'faq',
  'seoTitle',
  'seoDescription',
  'sources',
] as const

/**
 * A publish with no content edits. `id`, and a slug that still names this
 * row, are how MCP and PATCH /api/content/places address the place. A
 * different slug is a rename and counts as an edit.
 */
const PLACE_CONTENT_KEYS = [
  'title',
  'summary',
  'body',
  'sections',
  'hours',
  'price',
  'phone',
  'phoneSourceUrl',
  'website',
  'schemaType',
  'howToGet',
  'latitude',
  'longitude',
  'regionSlug',
  'categorySlug',
  'seoTitle',
  'seoDescription',
  'ogImage',
  'noindex',
  'sources',
  'visitDuration',
  'bestTime',
  'faq',
  'factsCheckedAt',
  'status',
] as const

function publicationOnly(input: PlaceDraftInput, currentSlug: string) {
  return isPublicationOnly(input, PLACE_CONTENT_KEYS, currentSlug)
}

function storedDraftResponse(
  current: {
    id: string
    slug: string
    title: string
    publicationStatus: string
    status: string
    updatedAt?: string
    lastVerifiedAt?: string | null
    phone?: string | null
    website?: string | null
    schemaType?: string | null
  },
  payload: Record<string, unknown>,
  pendingStatus: 'draft' | 'review',
  writingWarnings: string[],
) {
  const body = typeof payload.body === 'string' ? payload.body : ''
  const slug = typeof payload.slug === 'string' && payload.slug ? payload.slug : current.slug
  const title = typeof payload.title === 'string' && payload.title ? payload.title : current.title
  const status = typeof payload.status === 'string' ? payload.status : current.status
  const factsCheckedAt = Object.hasOwn(payload, 'lastVerifiedAt')
    ? (payload.lastVerifiedAt as string | null)
    : current.lastVerifiedAt
  const contact = {
    phone: mergedField(undefined, payload, 'phone', current.phone ?? null) as string | null,
    website: mergedField(undefined, payload, 'website', current.website ?? null) as string | null,
    schemaType: mergedField(undefined, payload, 'schemaType', current.schemaType ?? null) as string | null,
  }
  return {
    ...compactPlace({ ...current, slug, title, status, lastVerifiedAt: factsCheckedAt, ...contact }),
    phoneSourceUrl: mergedField(undefined, payload, 'phoneSourceUrl', null) as string | null,
    ...pendingDraftFields(body, pendingStatus, PLACE_RENDERED_FIELDS, writingWarnings),
  }
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
    phone: body.phone as string | null | undefined,
    phoneSourceUrl: body.phoneSourceUrl as string | null | undefined,
    website: body.website as string | null | undefined,
    schemaType: body.schemaType as string | null | undefined,
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
  const status = (VISIT.has(input.status || '') ? input.status : 'unknown') as VisitStatus
  const contact = await resolvePlaceContact(input, { placeId: null, phone: null, website: null, schemaType: null })
  const { row, writingWarnings } = await savePlaceContent({
    slug,
    title: input.title.trim(),
    summary: input.summary || '',
    body: input.body || '',
    ...(input.sections ? { sections: input.sections as never } : {}),
    status,
    hours: input.hours || null,
    price: input.price || null,
    phone: contact.phone,
    website: contact.website,
    schemaType: contact.schemaType,
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
  }, null, contentGate('place', {
    title: input.title,
    summary: input.summary,
    body: input.body,
    sections: input.sections,
    hours: input.hours,
    price: input.price,
    howToGet: input.howToGet,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    visitDuration: input.visitDuration,
    bestTime: input.bestTime,
    faq: input.faq,
    sources: input.sources,
    phone: contact.phone,
    phoneSourceUrl: contact.phoneSourceUrl,
    website: contact.website,
  }, publicationStatus === 'published'))
  await syncCoordinates({
    subjectType: 'place',
    subjectId: row.id,
    actor: 'mcp',
    pageStatus: publicationStatus,
    latitude: input.latitude,
    longitude: input.longitude,
    previous: { latitude: null, longitude: null },
  })
  await syncPlacePhone({
    placeId: row.id,
    actor: 'mcp',
    pageStatus: publicationStatus,
    phone: contact.phone,
    sourceUrl: contact.phoneSourceUrl,
    checkedAt: phoneCheckedAt(checked),
  })
  await syncPlaceStatus({
    placeId: row.id,
    actor: 'mcp',
    pageStatus: publicationStatus,
    status,
    previous: '',
  })
  await auditMcp('place_draft_create', 'place', row.id)
  return { ...compactPlace(row), writingWarnings }
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
  if (scope === 'editor' && publicationStatus === 'published' && pending && publicationOnly(input, current.slug)) {
    const payload = pending.payload
    const applied = await applyPendingPlaceContent(current.id, contentGate('place', {
      title: payload.title,
      summary: payload.summary,
      body: payload.body,
      sections: payload.sections,
      hours: payload.hours,
      price: payload.price,
      howToGet: payload.howToGet,
      seoTitle: payload.seoTitle,
      seoDescription: payload.seoDescription,
      visitDuration: payload.visitDuration,
      bestTime: payload.bestTime,
      faq: payload.faq,
      sources: payload.sources,
      phone: payload.phone,
      phoneSourceUrl: payload.phoneSourceUrl,
      website: payload.website,
    }, true), {
      beforeWrite: async (tx, draft) => {
        const body = draft.payload
        if (body.phone === undefined) {
          return
        }
        const pendingPhone = typeof body.phone === 'string' ? body.phone : null
        const phone = await syncPlacePhone({
          placeId: current.id,
          actor: 'mcp',
          pageStatus: 'published',
          phone: pendingPhone,
          sourceUrl: !pendingPhone
            ? null
            : typeof body.phoneSourceUrl === 'string'
              ? body.phoneSourceUrl
              : await placePhoneSource(current.id, tx),
          checkedAt: draft.updatedAt,
          tx,
        })
        return { phone: phone.skipped }
      },
      afterWrite: async (tx, row, existing) => {
        await syncCoordinates({
          subjectType: 'place',
          subjectId: current.id,
          actor: 'mcp',
          pageStatus: 'published',
          latitude: row.latitude,
          longitude: row.longitude,
          previous: { latitude: existing.latitude, longitude: existing.longitude },
          tx,
        })
        await syncPlaceStatus({
          placeId: current.id,
          actor: 'mcp',
          pageStatus: 'published',
          status: row.status,
          previous: existing.status,
          tx,
        })
      },
    })
    const row = applied.row
    if (row) {
      await auditMcp(auditTool, 'place', current.id)
      return { ...compactPlace(row), pendingReview: false, bodyLength: row.body.length, writingWarnings: applied.writingWarnings }
    }
  }
  if (publicationStatus === 'pending') {
    const slug = input.slug || String(pending?.payload.slug || current.slug)
    const problem = slugError(slug)
    if (problem) {
      throw createError({ statusCode: 400, statusMessage: problem })
    }
    const base = pending?.payload ?? {}
    const text = (key: string, value: string | null | undefined, fallback: string | null) => {
      const merged = mergedField(value, base, key, fallback)
      return merged ?? null
    }
    const checked = parseFactsCheckedAt(
      input.factsCheckedAt === undefined
        ? (base.factsCheckedAt as string | null | undefined) ?? (base.lastVerifiedAt as string | null | undefined)
        : input.factsCheckedAt,
    )
    const pendingStatus = pendingPublication(input.publicationStatus)
    const contact = await resolvePlaceContact(input, {
      placeId: current.id,
      phone: mergedField(undefined, base, 'phone', current.phone),
      website: mergedField(undefined, base, 'website', current.website),
      schemaType: mergedField(undefined, base, 'schemaType', current.schemaType),
      ...(Object.hasOwn(base, 'phoneSourceUrl') ? { phoneSourceUrl: base.phoneSourceUrl as string | null } : {}),
    })
    const payload = {
      slug,
      title: input.title ?? (base.title as string | undefined) ?? current.title,
      summary: input.summary ?? (base.summary as string | undefined) ?? current.summary,
      body: input.body ?? (base.body as string | undefined) ?? current.body,
      ...(input.sections ? { sections: input.sections } : base.sections ? { sections: base.sections } : {}),
      status: input.status && VISIT.has(input.status) ? input.status : (base.status as string | undefined) ?? current.status,
      hours: text('hours', input.hours, current.hours),
      price: text('price', input.price, current.price),
      ...contact,
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
    const storedDraft = await savePendingDraftContent({
      entityType: 'place',
      entityId: current.id,
      publicationStatus: pendingStatus,
      payload,
    }, contentGate('place', {
      title: payload.title,
      summary: payload.summary,
      body: payload.body,
      sections: payload.sections,
      hours: payload.hours,
      price: payload.price,
      howToGet: payload.howToGet,
      seoTitle: payload.seoTitle,
      seoDescription: payload.seoDescription,
      visitDuration: payload.visitDuration,
      bestTime: payload.bestTime,
      faq: payload.faq,
      sources: payload.sources,
      phone: payload.phone,
      phoneSourceUrl: payload.phoneSourceUrl,
      website: payload.website,
    }, false))
    const stored = storedDraft.row
    const writingWarnings = storedDraft.writingWarnings
    await auditMcp(auditTool, 'place', current.id)
    return storedDraftResponse(current, stored.payload, pendingStatus, writingWarnings)
  }
  const slug = input.slug || current.slug
  const problem = slugError(slug)
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
  const checked = parseFactsCheckedAt(input.factsCheckedAt)
  const status = (input.status && VISIT.has(input.status) ? input.status : current.status) as VisitStatus
  const contact = await resolvePlaceContact(input, {
    placeId: current.id,
    phone: current.phone,
    website: current.website,
    schemaType: current.schemaType,
  })
  const category = await categoryId(input.categorySlug, current.categoryId)
  const region = await regionIdOf(input.regionSlug, current.regionId)
  const gate = contentGate('place', {
    title: input.title ?? current.title,
    summary: input.summary ?? current.summary,
    body: input.body ?? current.body,
    sections: input.sections,
    hours: input.hours === undefined ? current.hours : input.hours,
    price: input.price === undefined ? current.price : input.price,
    howToGet: input.howToGet === undefined ? current.howToGet : input.howToGet,
    seoTitle: input.seoTitle === undefined ? current.seoTitle : input.seoTitle,
    seoDescription: input.seoDescription === undefined ? current.seoDescription : input.seoDescription,
    visitDuration: input.visitDuration === undefined ? current.visitDuration : input.visitDuration,
    bestTime: input.bestTime === undefined ? current.bestTime : input.bestTime,
    faq: input.faq === undefined ? current.faq : input.faq,
    sources: input.sources ?? current.sources,
    phone: contact.phone,
    phoneSourceUrl: contact.phoneSourceUrl,
    website: contact.website,
  }, publicationStatus === 'published')
  const writeLive = async (tx: ContentTx) => {
    const point = await syncCoordinates({
      subjectType: 'place',
      subjectId: current.id,
      actor: 'mcp',
      pageStatus: publicationStatus,
      latitude: input.latitude,
      longitude: input.longitude,
      previous: { latitude: current.latitude, longitude: current.longitude },
      tx,
    })
    const visit = await syncPlaceStatus({
      placeId: current.id,
      actor: 'mcp',
      pageStatus: publicationStatus,
      status: input.status && VISIT.has(input.status) ? input.status : undefined,
      previous: current.status,
      tx,
    })
    const phone = await syncPlacePhone({
      placeId: current.id,
      actor: 'mcp',
      pageStatus: publicationStatus,
      phone: contact.phone,
      sourceUrl: contact.phoneSourceUrl,
      checkedAt: phoneCheckedAt(checked),
      tx,
    })
    const saved = await savePlaceContent({
      id: current.id,
      slug,
      title: input.title ?? current.title,
      summary: input.summary ?? current.summary,
      body: input.body ?? current.body,
      ...(input.sections ? { sections: input.sections as never } : {}),
      status: visit.skipped ? current.status : status,
      hours: input.hours === undefined ? current.hours : input.hours,
      price: input.price === undefined ? current.price : input.price,
      phone: phone.skipped ? current.phone : contact.phone,
      website: contact.website,
      schemaType: contact.schemaType,
      howToGet: input.howToGet === undefined ? current.howToGet : input.howToGet,
      latitude: point.skipped || input.latitude === undefined ? current.latitude : input.latitude,
      longitude: point.skipped || input.longitude === undefined ? current.longitude : input.longitude,
      categoryId: category,
      regionId: region,
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
    }, null, gate, tx)
    return { ...saved.row, writingWarnings: saved.writingWarnings }
  }
  const saved = scope === 'editor'
    ? await withEditorLiveWrite('place', current.id, writeLive)
    : await db.editor.transaction(async (tx) => {
        const row = await writeLive(tx)
        return { ...row, draftDropped: false }
      })
  if (scope !== 'editor') {
    await syncSavedPage('place', saved.id)
  }
  await auditMcp(auditTool, 'place', current.id)
  return {
    ...compactPlace(saved),
    phoneSourceUrl: contact.phoneSourceUrl,
    pendingReview: false as const,
    writingWarnings: saved.writingWarnings,
    ...(scope === 'editor' ? { draftDropped: saved.draftDropped } : {}),
  }
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
  const { row } = await savePlaceContent({
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
  }, null, contentGate('place', {
    title: current.title,
    summary: current.summary,
    body: current.body,
    hours: current.hours,
    price: current.price,
    howToGet: current.howToGet,
    seoTitle: current.seoTitle,
    seoDescription: current.seoDescription,
    sources: current.sources,
  }, false))
  await auditMcp('place_submit_review', 'place', current.id)
  return compactPlace(row)
}
