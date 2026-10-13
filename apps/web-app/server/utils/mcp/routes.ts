import { db } from '@k39/database'
import { createError } from 'h3'
import { slugError } from '../../../shared/seo'
import { auditMcp } from './audit'
import { rethrowContentWrite } from './content-error'
import { normalizePublication } from './draft'

type StopInput = { placeSlug: string, note?: string | null }

export interface RouteWriteInput {
  id?: string
  slug?: string
  title?: string
  summary?: string
  body?: string
  publicationStatus?: string
  seoTitle?: string | null
  seoDescription?: string | null
  points?: StopInput[]
  path?: [number, number][] | null
}

export function orderedStopView(rows: Array<{ placeSlug: string, title: string, note: string | null, position: number }>) {
  return rows.map((row) => ({
    placeSlug: row.placeSlug,
    slug: row.placeSlug,
    title: row.title,
    note: row.note,
    position: row.position,
  }))
}

export async function createRouteDraft(input: {
  slug: string
  title: string
  summary?: string
  body?: string
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
  try {
    const row = await db.editor.saveRoute({
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      body: input.body,
      publicationStatus: normalizePublication(input.publicationStatus),
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      points: input.points,
      path: input.path,
    })
    await auditMcp('route_draft_create', 'route', row.id)
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      publicationStatus: row.publicationStatus,
      points: orderedStopView(await db.editor.routePoints(row.id)),
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
  const slug = input.slug || current.slug
  const problem = slugError(slug)
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
  try {
    const row = await db.editor.saveRoute({
      id: current.id,
      slug,
      title: input.title || current.title,
      summary: input.summary ?? current.summary,
      body: input.body ?? current.body,
      publicationStatus: normalizePublication(input.publicationStatus, current.publicationStatus),
      seoTitle: input.seoTitle === undefined ? current.seoTitle : input.seoTitle,
      seoDescription: input.seoDescription === undefined ? current.seoDescription : input.seoDescription,
      points: input.points,
      path: input.path,
    })
    await auditMcp(auditTool, 'route', current.id)
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      publicationStatus: row.publicationStatus,
      points: orderedStopView(await db.editor.routePoints(row.id)),
    }
  } catch (error) {
    rethrowContentWrite(error)
  }
}
