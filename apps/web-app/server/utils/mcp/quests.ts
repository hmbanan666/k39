import { db } from '@k39/database'
import { createError } from 'h3'
import { slugError } from '../../../shared/seo'
import { saveQuestContent } from '../content/save'
import { auditMcp } from './audit'
import { rethrowContentWrite } from './content-error'
import { refusePendingLiveEdit, resolvePublication } from './draft'

export interface QuestStepInput {
  placeSlug: string
  title: string
  prompt?: string | null
}

export interface QuestWriteInput {
  id?: string
  slug?: string
  title?: string
  summary?: string | null
  body?: string
  publicationStatus?: string
  seoTitle?: string | null
  seoDescription?: string | null
  ogImage?: string | null
  noindex?: boolean
  routeSlug?: string | null
  steps?: QuestStepInput[]
}

// null clears the link. A slug may point at a draft route.
// Moving or clearing the link is what lets content_archive delete that draft.
export function routeIdForSlug(
  routeSlug: string | null | undefined,
  routes: Array<{ id: string, slug: string }>,
): string | null | undefined {
  if (routeSlug === undefined) {
    return undefined
  }
  if (routeSlug === null) {
    return null
  }
  const route = routes.find((item) => item.slug === routeSlug)
  if (!route) {
    throw createError({ statusCode: 400, statusMessage: 'Маршрут не найден' })
  }
  return route.id
}

export function routeSlugOf(routeId: string | null | undefined, routes: Array<{ id: string, slug: string }>) {
  if (!routeId) {
    return null
  }
  return routes.find((item) => item.id === routeId)?.slug ?? null
}

export async function writeQuest(input: QuestWriteInput, auditTool: string, options?: { create?: boolean }) {
  const create = options?.create !== false
  if (!input.id && !input.slug) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен id или slug' })
  }
  const current = input.id
    ? await db.editor.questById(input.id)
    : input.slug
      ? await db.editor.questBySlug(input.slug)
      : null
  if (!current && !create) {
    throw createError({ statusCode: 404, statusMessage: 'Квест не найден' })
  }
  const slug = input.slug || current?.slug
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен slug' })
  }
  const problem = slugError(slug)
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
  const title = (input.title ?? current?.title ?? '').trim()
  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'Нужно название' })
  }
  const routes = await db.editor.listRoutes()
  const routeId = routeIdForSlug(input.routeSlug, routes)
  const publicationStatus = resolvePublication(input.publicationStatus, current?.publicationStatus)
  refusePendingLiveEdit(publicationStatus, 'quest')
  try {
    const { row, writingWarnings } = await saveQuestContent({
      id: current?.id,
      slug,
      title,
      summary: input.summary,
      body: input.body,
      publicationStatus,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      ogImage: input.ogImage,
      noindex: input.noindex,
      routeId,
      steps: input.steps,
    }, null, {
      prose: [
        title,
        input.summary === undefined ? current?.summary : input.summary,
        input.body === undefined ? current?.body : input.body,
        input.seoTitle === undefined ? current?.seoTitle : input.seoTitle,
        input.seoDescription === undefined ? current?.seoDescription : input.seoDescription,
        input.steps,
      ],
      publishing: publicationStatus === 'published',
    })
    await auditMcp(auditTool, 'quest', row.id)
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      publicationStatus: row.publicationStatus,
      routeSlug: routeSlugOf(row.routeId, routes),
      writingWarnings,
    }
  } catch (error) {
    rethrowContentWrite(error)
  }
}
