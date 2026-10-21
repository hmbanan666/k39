import type { CollectionDraftSide, ContentDraftNotice, RouteDraftSide } from '../../../shared/content-draft-diff'
import { db } from '@k39/database'
import { createError } from 'h3'
import { collectionDraftChanges, routeDraftChanges } from '../../../shared/content-draft-diff'
import { formatDraftUpdated } from '../../../shared/place-draft-diff'
import { withContentScope } from '../access'
import { syncSavedPage } from '../content/save'
import { setPublication } from '../mcp/publish'

type EditorTx = NonNullable<Parameters<typeof db.editor.saveCollection>[2]>

type Stop = { placeSlug: string, note?: string | null }

function asStops(value: unknown): Stop[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || typeof (item as { placeSlug?: unknown }).placeSlug !== 'string') {
      return []
    }
    const row = item as { placeSlug: string, note?: unknown }
    const note = typeof row.note === 'string' ? row.note : null
    return [{ placeSlug: row.placeSlug, note }]
  })
}

function notice(draft: { updatedAt: string, publicationStatus: 'draft' | 'review' }, changes: ContentDraftNotice['changes']): ContentDraftNotice {
  return {
    updatedAt: draft.updatedAt,
    updatedLabel: formatDraftUpdated(draft.updatedAt),
    publicationStatus: draft.publicationStatus,
    changes,
  }
}

async function liveStops(kind: 'collection' | 'route', id: string): Promise<Stop[]> {
  const rows = kind === 'collection'
    ? await db.editor.collectionItems(id)
    : await db.editor.routePoints(id)
  return rows.map((row) => ({ placeSlug: row.placeSlug, note: row.note }))
}

export async function collectionDraftNotice(id: string): Promise<ContentDraftNotice | null> {
  const row = (await db.editor.listCollections()).find((item) => item.id === id)
  if (!row) {
    return null
  }
  const draft = await db.editor.contentDraft('collection', id)
  if (!draft) {
    return null
  }
  const next = db.editor.pendingCollectionNext(row, draft.payload)
  const payloadItems = asStops(draft.payload.items)
  const items = payloadItems ?? await liveStops('collection', id)
  const liveItems = payloadItems ? await liveStops('collection', id) : items
  const live: CollectionDraftSide = {
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    body: row.body,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    ogImage: row.ogImage,
    noindex: row.noindex,
    kind: row.kind,
    month: row.month,
    sources: row.sources,
    modules: row.modules,
    items: liveItems,
    publicationStatus: row.publicationStatus,
  }
  const pending: CollectionDraftSide = {
    title: next.title,
    slug: next.slug,
    summary: next.summary,
    body: next.body,
    seoTitle: next.seoTitle,
    seoDescription: next.seoDescription,
    ogImage: next.ogImage,
    noindex: next.noindex,
    kind: next.kind,
    month: next.month,
    sources: next.sources,
    modules: next.modules,
    items,
    publicationStatus: next.publicationStatus,
  }
  return notice(draft, collectionDraftChanges(live, pending))
}

export async function routeDraftNotice(id: string): Promise<ContentDraftNotice | null> {
  const row = (await db.editor.listRoutes()).find((item) => item.id === id)
  if (!row) {
    return null
  }
  const draft = await db.editor.contentDraft('route', id)
  if (!draft) {
    return null
  }
  const next = db.editor.pendingRouteNext(row, draft.payload)
  const payloadPoints = asStops(draft.payload.points)
  const points = payloadPoints ?? await liveStops('route', id)
  const livePoints = payloadPoints ? await liveStops('route', id) : points
  const live: RouteDraftSide = {
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    body: row.body,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    ogImage: row.ogImage,
    noindex: row.noindex,
    points: livePoints,
    path: row.path ?? null,
    publicationStatus: row.publicationStatus,
  }
  const pending: RouteDraftSide = {
    title: next.title,
    slug: next.slug,
    summary: next.summary,
    body: next.body,
    seoTitle: next.seoTitle,
    seoDescription: next.seoDescription,
    ogImage: next.ogImage,
    noindex: next.noindex,
    points,
    path: next.path ?? null,
    publicationStatus: next.publicationStatus,
  }
  return notice(draft, routeDraftChanges(live, pending))
}

export async function attachDraftNotices<T extends { id: string }>(
  entity: 'collection' | 'route',
  rows: T[],
) {
  const drafts = await db.editor.contentDraftsFor(entity)
  const wanted = new Set(drafts.map((draft) => draft.entityId))
  const notices = new Map<string, ContentDraftNotice | null>()
  await Promise.all([...wanted].map(async (id) => {
    const view = entity === 'collection' ? await collectionDraftNotice(id) : await routeDraftNotice(id)
    notices.set(id, view)
  }))
  return rows
    .map((row) => ({ ...row, pending: notices.get(row.id) ?? null }))
    .sort((left, right) => Number(Boolean(right.pending)) - Number(Boolean(left.pending)))
}

/**
 * A pending draft blocks an admin save until the body sets `pendingDraft`
 * to `discard`. The discard deletes only the draft that was checked, in the
 * same transaction as the save, so a newer draft written in between stays.
 */
export async function withPendingGuard<T extends { id: string }>(
  entity: 'collection' | 'route',
  id: string,
  pendingDraft: unknown,
  write: (tx: EditorTx) => Promise<T>,
) {
  const pending = await db.editor.contentDraft(entity, id)
  if (pending && pendingDraft !== 'discard') {
    throw createError({ statusCode: 409, statusMessage: 'Есть черновик. Примените его или отбросьте.' })
  }
  const stamp = pending && pendingDraft === 'discard'
    ? { id: pending.id, updatedAt: pending.updatedAt }
    : null
  const saved = await db.editor.transaction(async (tx) => {
    const result = await write(tx)
    if (stamp) {
      await db.editor.deleteContentDraftIfUnchanged(stamp.id, stamp.updatedAt, tx)
    }
    return result
  })
  await syncSavedPage(entity, saved.id)
  return saved
}

export async function applyAdminContentDraft(entity: 'collection' | 'route', id: string) {
  const pending = await db.editor.contentDraft(entity, id)
  if (!pending) {
    throw createError({ statusCode: 409, statusMessage: 'Черновика нет' })
  }
  if (entity === 'collection') {
    return withContentScope('editor', () => setPublication({
      entity: 'collection',
      id,
      publicationStatus: 'published',
    }))
  }
  return withContentScope('editor', () => setPublication({
    entity: 'route',
    id,
    publicationStatus: 'published',
  }))
}

export async function discardAdminContentDraft(entity: 'collection' | 'route', id: string) {
  const pending = await db.editor.contentDraft(entity, id)
  if (!pending) {
    throw createError({ statusCode: 409, statusMessage: 'Черновика нет' })
  }
  await db.editor.deleteContentDraft(entity, id)
  return { discarded: true as const }
}
