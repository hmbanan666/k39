import type { AuthorKind, PublicationStatus, VisitStatus } from '@k39/database'
import type { PlaceDraftNotice } from '../../../shared/place-draft-diff'
import { db } from '@k39/database'
import { createError } from 'h3'
import { formatDraftUpdated, placeDraftChanges } from '../../../shared/place-draft-diff'
import { slugError } from '../../../shared/seo'
import { writingCopy } from '../../../shared/writing'
import { withContentScope } from '../access'
import { syncCoordinates, syncPlaceStatus } from '../facts/sync'
import { setPublication } from '../mcp/publish'
import { writingGate } from '../mcp/writing-guard'

const VISIT = new Set<VisitStatus>(['open', 'ruins', 'closed', 'unknown'])
const PUBLICATION = new Set<PublicationStatus>(['draft', 'review', 'published', 'archived'])

export interface AdminPlaceWrite {
  slug?: string
  title?: string
  summary?: string
  body?: string
  status?: string | null
  publicationStatus?: string
  hours?: string | null
  price?: string | null
  howToGet?: string | null
  latitude?: number | null
  longitude?: number | null
  categorySlug?: string
  regionId?: string | null
  sources?: unknown
  seoTitle?: string | null
  seoDescription?: string | null
  ogImage?: string | null
  noindex?: boolean
  authorKind?: string
  /** Set to `discard` to write the form and delete a pending draft. */
  pendingDraft?: string
}

function asPublication(value: string | undefined, current: PublicationStatus): PublicationStatus {
  if (value && PUBLICATION.has(value as PublicationStatus)) {
    return value as PublicationStatus
  }
  return current
}

function asVisit(value: string | null | undefined): VisitStatus | undefined {
  if (value && VISIT.has(value as VisitStatus)) {
    return value as VisitStatus
  }
  return undefined
}

function asAuthor(value: string | undefined, current: AuthorKind): AuthorKind {
  if (value === 'ai' || value === 'human') {
    return value
  }
  return current
}

/**
 * Pending draft for the admin place form. `pending` is null when the live
 * row has no `content_drafts` entry. Changed fields are what Apply would write.
 */
export async function adminPlaceDraftView(id: string): Promise<{ pending: PlaceDraftNotice | null }> {
  const live = await db.editor.placeById(id)
  if (!live) {
    throw createError({ statusCode: 404, statusMessage: 'Место не найдено' })
  }
  const draft = await db.editor.contentDraft('place', id)
  if (!draft) {
    return { pending: null }
  }
  const next = db.editor.pendingPlaceNext(live, draft.payload)
  const [categories, regions] = await Promise.all([
    db.content.categories(),
    db.editor.listRegions(),
  ])
  return {
    pending: {
      updatedAt: draft.updatedAt,
      updatedLabel: formatDraftUpdated(draft.updatedAt),
      publicationStatus: draft.publicationStatus,
      changes: placeDraftChanges(live, next, {
        category: new Map(categories.map((item) => [item.id, item.title])),
        region: new Map(regions.map((item) => [item.id, item.title])),
      }),
    },
  }
}

/**
 * Publishes the pending payload through `setPublication`, the same writer
 * as `content_set_publication`. Always the editor scope, so a draft-scoped
 * caller cannot turn this into another pending write.
 */
export async function applyAdminPlaceDraft(id: string) {
  const current = await db.editor.placeById(id)
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Место не найдено' })
  }
  const pending = await db.editor.contentDraft('place', id)
  if (!pending) {
    throw createError({ statusCode: 409, statusMessage: 'Черновика нет' })
  }
  return withContentScope('editor', () => setPublication({
    entity: 'place',
    id,
    publicationStatus: 'published',
  }))
}

/** Deletes the pending draft and leaves the live row as it is. */
export async function discardAdminPlaceDraft(id: string) {
  const current = await db.editor.placeById(id)
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Место не найдено' })
  }
  const pending = await db.editor.contentDraft('place', id)
  if (!pending) {
    throw createError({ statusCode: 409, statusMessage: 'Черновика нет' })
  }
  await db.editor.deleteContentDraft('place', id)
  return { discarded: true as const }
}

/**
 * Admin form save. A pending draft blocks the write until the body sets
 * `pendingDraft` to `discard`, which stores the form and then deletes the draft.
 */
export async function saveAdminPlace(id: string, body: AdminPlaceWrite, userId: string | null) {
  const current = await db.editor.placeById(id)
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Место не найдено' })
  }
  const pending = await db.editor.contentDraft('place', id)
  if (pending && body.pendingDraft !== 'discard') {
    throw createError({ statusCode: 409, statusMessage: 'Есть черновик. Примените его или отбросьте.' })
  }
  const slug = String(body.slug || current.slug)
  const problem = slugError(slug)
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
  const category = body.categorySlug ? await db.content.categoryBySlug(String(body.categorySlug)) : null
  const publicationStatus = asPublication(body.publicationStatus, current.publicationStatus)
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
  const visitStatus = asVisit(body.status)
  const point = await syncCoordinates({
    subjectType: 'place',
    subjectId: id,
    actor: 'editor',
    pageStatus: publicationStatus,
    latitude: body.latitude,
    longitude: body.longitude,
    previous: { latitude: current.latitude, longitude: current.longitude },
  })
  const visit = await syncPlaceStatus({
    placeId: id,
    actor: 'editor',
    pageStatus: publicationStatus,
    status: visitStatus,
    previous: current.status,
  })
  const row = await db.editor.savePlace({
    id,
    slug,
    title: String(body.title ?? current.title),
    summary: String(body.summary ?? current.summary),
    body: String(body.body ?? current.body),
    status: (visit.skipped || body.status == null ? current.status : body.status) as VisitStatus,
    hours: body.hours ?? current.hours,
    price: body.price ?? current.price,
    howToGet: body.howToGet ?? current.howToGet,
    latitude: point.skipped || body.latitude == null ? current.latitude : body.latitude,
    longitude: point.skipped || body.longitude == null ? current.longitude : body.longitude,
    categoryId: category?.id ?? current.categoryId,
    regionId: body.regionId ?? current.regionId,
    sources: Array.isArray(body.sources) ? body.sources as typeof current.sources : current.sources,
    seoTitle: body.seoTitle ?? current.seoTitle,
    seoDescription: body.seoDescription ?? current.seoDescription,
    ogImage: body.ogImage ?? current.ogImage,
    publicationStatus,
    noindex: body.noindex ?? current.noindex,
    authorKind: asAuthor(body.authorKind, current.authorKind),
  }, userId)
  if (pending) {
    await db.editor.deleteContentDraft('place', id)
  }
  return { ...row, writingWarnings }
}
