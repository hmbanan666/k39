import { composeBody, db, readSections } from '@k39/database'
import { createError } from 'h3'
import { slugError } from '../../../shared/seo'
import { contentScope } from '../access'
import { liveWriteRow, withEditorLiveWrite } from '../content/pending-guard'
import { applyPendingRouteContent, contentGate, savePendingDraftContent, saveRouteContent } from '../content/save'
import { auditMcp } from './audit'
import { rethrowContentWrite } from './content-error'
import { refusePendingLiveEdit, resolvePublication } from './draft'
import { isPublicationOnly, mergedField, mergedPresent, pendingDraftFields, pendingPublication } from './pending'

type StopInput = { placeSlug: string, note?: string | null }

export interface RouteWriteInput {
  id?: string
  slug?: string
  title?: string
  summary?: string
  body?: string
  sections?: unknown[]
  publicationStatus?: string
  seoTitle?: string | null
  seoDescription?: string | null
  ogImage?: string | null
  noindex?: boolean
  points?: StopInput[]
  path?: [number, number][] | null
}

const ROUTE_CONTENT_KEYS = [
  'title',
  'summary',
  'body',
  'sections',
  'seoTitle',
  'seoDescription',
  'ogImage',
  'noindex',
  'points',
  'path',
] as const

export const ROUTE_RENDERED_FIELDS = [
  'title',
  'summary',
  'body',
  'points',
  'path',
  'seoTitle',
  'seoDescription',
] as const

export function orderedStopView(rows: Array<{ placeSlug: string, title: string, note: string | null, position: number }>) {
  return rows.map((row) => ({
    placeSlug: row.placeSlug,
    slug: row.placeSlug,
    title: row.title,
    note: row.note,
    position: row.position,
  }))
}

export async function describedStops(stops: StopInput[]) {
  const rows = []
  for (const [position, stop] of stops.entries()) {
    const place = await db.editor.placeBySlug(stop.placeSlug)
    rows.push({
      placeSlug: stop.placeSlug,
      slug: stop.placeSlug,
      title: place?.title ?? stop.placeSlug,
      note: stop.note?.trim() || null,
      position,
    })
  }
  return rows
}

export async function stopsForPayload(routeId: string, payload: Record<string, unknown>) {
  if (Array.isArray(payload.points)) {
    return describedStops(payload.points as StopInput[])
  }
  return orderedStopView(await db.editor.routePoints(routeId))
}

export async function createRouteDraft(input: {
  slug: string
  title: string
  summary?: string
  body?: string
  sections?: unknown[]
  publicationStatus?: string
  seoTitle?: string | null
  seoDescription?: string | null
  points?: StopInput[]
  path?: [number, number][] | null
}) {
  const problem = slugError(input.slug)
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
  const publicationStatus = resolvePublication(input.publicationStatus)
  refusePendingLiveEdit(publicationStatus, 'route')
  try {
    const { row, writingWarnings } = await saveRouteContent({
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      body: input.body,
      sections: input.sections,
      publicationStatus,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      points: input.points,
      path: input.path,
    }, null, contentGate('route', {
      title: input.title,
      summary: input.summary,
      body: input.body,
      sections: input.sections,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      points: input.points,
    }, publicationStatus === 'published'))
    await auditMcp('route_draft_create', 'route', row.id)
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      publicationStatus: row.publicationStatus,
      points: orderedStopView(await db.editor.routePoints(row.id)),
      writingWarnings,
    }
  } catch (error) {
    rethrowContentWrite(error)
  }
}

export async function updateRouteDraft(input: RouteWriteInput, auditTool = 'route_draft_update') {
  const rows = await db.editor.listRoutes()
  const current = input.id
    ? rows.find((item) => item.id === input.id)
    : rows.find((item) => item.slug === input.slug)
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Маршрут не найден' })
  }
  const scope = contentScope()
  const pending = await db.editor.contentDraft('route', current.id)
  const publicationStatus = resolvePublication(input.publicationStatus, current.publicationStatus, scope)
  if (scope === 'editor' && publicationStatus === 'published' && pending && isPublicationOnly(input, ROUTE_CONTENT_KEYS, current.slug)) {
    const payload = pending.payload
    const applied = await applyPendingRouteContent(current.id, contentGate('route', payload, true))
    const row = applied.row
    if (row) {
      await auditMcp(auditTool, 'route', current.id)
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        publicationStatus: row.publicationStatus,
        points: orderedStopView(await db.editor.routePoints(row.id)),
        pendingReview: false as const,
        bodyLength: row.body.length,
        writingWarnings: applied.writingWarnings,
      }
    }
  }
  if (publicationStatus === 'pending') {
    const base = pending?.payload ?? {}
    const slug = input.slug || (typeof base.slug === 'string' && base.slug ? base.slug : current.slug)
    const problem = slugError(slug)
    if (problem) {
      throw createError({ statusCode: 400, statusMessage: problem })
    }
    const sections = mergedPresent(input.sections, base, 'sections')
    const body = sections.set
      ? composeBody(readSections(sections.value))
      : mergedField(input.body, base, 'body', current.body)
    const points = mergedPresent(input.points, base, 'points')
    const path = mergedPresent(input.path, base, 'path')
    const pendingStatus = pendingPublication(input.publicationStatus)
    const payload: Record<string, unknown> = {
      slug,
      title: input.title ?? (typeof base.title === 'string' ? base.title : current.title),
      summary: mergedField(input.summary, base, 'summary', current.summary),
      body,
      seoTitle: mergedField(input.seoTitle, base, 'seoTitle', current.seoTitle),
      seoDescription: mergedField(input.seoDescription, base, 'seoDescription', current.seoDescription),
      ogImage: mergedField(input.ogImage, base, 'ogImage', current.ogImage),
      noindex: mergedField(input.noindex, base, 'noindex', current.noindex),
    }
    if (sections.set) {
      payload.sections = readSections(sections.value)
    }
    if (points.set) {
      payload.points = points.value ?? []
    }
    if (path.set) {
      payload.path = path.value ?? null
    }
    try {
      if (points.set) {
        await db.editor.assertOrderedStops(points.value ?? [])
      }
      const stored = await savePendingDraftContent({
        entityType: 'route',
        entityId: current.id,
        publicationStatus: pendingStatus,
        payload,
      }, contentGate('route', payload, false))
      await auditMcp(auditTool, 'route', current.id)
      return {
        id: current.id,
        slug,
        title: String(payload.title),
        publicationStatus: current.publicationStatus,
        points: await stopsForPayload(current.id, payload),
        path: Object.hasOwn(payload, 'path') ? payload.path as [number, number][] | null : current.path,
        ...pendingDraftFields(String(payload.body ?? ''), pendingStatus, ROUTE_RENDERED_FIELDS, stored.writingWarnings),
      }
    } catch (error) {
      rethrowContentWrite(error)
    }
  }
  const slug = input.slug || current.slug
  const problem = slugError(slug)
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
  try {
    const write = {
      id: current.id,
      slug,
      title: input.title || current.title,
      summary: input.summary ?? current.summary,
      body: input.body ?? current.body,
      sections: input.sections,
      publicationStatus,
      seoTitle: input.seoTitle === undefined ? current.seoTitle : input.seoTitle,
      seoDescription: input.seoDescription === undefined ? current.seoDescription : input.seoDescription,
      points: input.points,
      path: input.path,
    }
    const gate = contentGate('route', {
      title: input.title || current.title,
      summary: input.summary ?? current.summary,
      body: input.body ?? current.body,
      sections: input.sections,
      seoTitle: input.seoTitle === undefined ? current.seoTitle : input.seoTitle,
      seoDescription: input.seoDescription === undefined ? current.seoDescription : input.seoDescription,
      points: input.points,
    }, publicationStatus === 'published')
    const saved = scope === 'editor'
      ? await withEditorLiveWrite('route', current.id, async (tx) => {
          const written = await saveRouteContent(write, null, gate, tx)
          return liveWriteRow(written.row, written.writingWarnings)
        })
      : await saveRouteContent(write, null, gate).then((written) => liveWriteRow(written.row, written.writingWarnings))
    await auditMcp(auditTool, 'route', current.id)
    return {
      id: saved.id,
      slug: saved.slug,
      title: saved.title,
      publicationStatus: saved.publicationStatus,
      points: orderedStopView(await db.editor.routePoints(saved.id)),
      pendingReview: false as const,
      writingWarnings: saved.writingWarnings,
      ...(scope === 'editor' ? { draftDropped: saved.draftDropped } : {}),
    }
  } catch (error) {
    rethrowContentWrite(error)
  }
}

export async function readRoute(input: { id?: string, slug?: string }) {
  const rows = await db.editor.listRoutes()
  const route = rows.find((item) => item.id === input.id || item.slug === input.slug)
  if (!route) {
    throw createError({ statusCode: 404, statusMessage: 'Маршрут не найден' })
  }
  const draft = await db.editor.contentDraft('route', route.id)
  return {
    id: route.id,
    slug: route.slug,
    title: route.title,
    summary: route.summary,
    body: route.body,
    sections: route.sections ?? [],
    publicationStatus: route.publicationStatus,
    seoTitle: route.seoTitle,
    seoDescription: route.seoDescription,
    points: orderedStopView(await db.editor.routePoints(route.id)),
    path: route.path ?? null,
    pendingReview: draft
      ? {
          publicationStatus: draft.publicationStatus,
          updatedAt: draft.updatedAt,
          payload: draft.payload,
        }
      : null,
  }
}
