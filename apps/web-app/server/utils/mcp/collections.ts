import type { Collection, StoredPageModule } from '@k39/database'
import { db } from '@k39/database'
import { createError } from 'h3'
import { COLLECTION_BODY_REJECTED, collectionWritePlan } from '../../../shared/page-modules'
import { slugError } from '../../../shared/seo'
import { contentScope } from '../access'
import { applyPendingCollectionContent, contentGate, saveCollectionContent, savePendingDraftContent } from '../content/save'
import { auditMcp } from './audit'
import { rethrowContentWrite } from './content-error'
import { resolvePublication } from './draft'
import { isPublicationOnly, mergedField, mergedPresent, pendingDraftFields, pendingPublication } from './pending'
import { describedStops, orderedStopView } from './routes'

type CollectionStop = Parameters<typeof orderedStopView>[0][number]

/** Every stored collection column, plus the ordered places and what renders. */
export function collectionView(row: Collection, items: CollectionStop[]) {
  const plan = collectionWritePlan({
    sentBody: undefined,
    currentBody: row.body,
    modules: row.modules,
  })
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    ogImage: row.ogImage,
    publicationStatus: row.publicationStatus,
    noindex: row.noindex,
    firstPublishedAt: row.firstPublishedAt,
    updatedBy: row.updatedBy,
    kind: row.kind,
    month: row.month,
    sources: row.sources,
    modules: row.modules,
    items: orderedStopView(items),
    article: plan.article,
    renderedFields: plan.renderedFields,
  } satisfies Collection & {
    items: ReturnType<typeof orderedStopView>
    article: 'modules' | 'body'
    renderedFields: readonly string[]
  }
}

type CollectionStopInput = { placeSlug: string, note?: string | null }

export interface CollectionWriteInput {
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
  kind?: 'theme' | 'month'
  month?: number | null
  sources?: Array<{ title: string, url: string }>
  items?: CollectionStopInput[]
  modules?: StoredPageModule[]
}

const COLLECTION_CONTENT_KEYS = [
  'title',
  'summary',
  'body',
  'seoTitle',
  'seoDescription',
  'ogImage',
  'noindex',
  'kind',
  'month',
  'sources',
  'items',
  'modules',
] as const

function collectionMonth(kind: string, input: CollectionWriteInput, base: Record<string, unknown>, current: number | null) {
  if (kind === 'theme') {
    return null
  }
  return mergedField(input.month, base, 'month', current)
}

export async function saveCollectionDraft(input: CollectionWriteInput, auditTool = 'collection_save', options?: { create?: boolean }) {
  const rows = await db.editor.listCollections()
  const current = input.id
    ? rows.find((item) => item.id === input.id)
    : input.slug
      ? rows.find((item) => item.slug === input.slug)
      : undefined
  if (!current && options?.create === false) {
    throw createError({ statusCode: 404, statusMessage: 'Подборка не найдена' })
  }
  const scope = contentScope()
  const pending = current ? await db.editor.contentDraft('collection', current.id) : null
  const publicationStatus = resolvePublication(input.publicationStatus, current?.publicationStatus, scope)
  if (current && scope === 'editor' && publicationStatus === 'published' && pending && isPublicationOnly(input, COLLECTION_CONTENT_KEYS, current.slug)) {
    const payload = pending.payload
    const plan = collectionWritePlan({
      sentBody: undefined,
      currentBody: typeof payload.body === 'string' ? payload.body : current.body,
      modules: payload.modules,
    })
    const applied = await applyPendingCollectionContent(current.id, contentGate('collection', { ...payload, copy: plan.copy }, true))
    const row = applied.row
    if (row) {
      await auditMcp(auditTool, 'collection', current.id)
      const storedPlan = collectionWritePlan({
        sentBody: undefined,
        currentBody: row.body,
        modules: row.modules,
      })
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        publicationStatus: row.publicationStatus,
        kind: row.kind,
        month: row.month,
        sources: row.sources,
        body: row.body,
        modules: row.modules,
        article: storedPlan.article,
        renderedFields: storedPlan.renderedFields,
        items: orderedStopView(await db.editor.collectionItems(row.id)),
        pendingReview: false as const,
        bodyLength: row.body.length,
        writingWarnings: applied.writingWarnings,
      }
    }
  }
  if (publicationStatus === 'pending') {
    if (!current) {
      throw createError({ statusCode: 404, statusMessage: 'Подборка не найдена' })
    }
    const base = pending?.payload ?? {}
    const slug = input.slug || (typeof base.slug === 'string' && base.slug ? base.slug : current.slug)
    const problem = slugError(slug)
    if (problem) {
      throw createError({ statusCode: 400, statusMessage: problem })
    }
    const modules = mergedField(input.modules, base, 'modules', current.modules)
    const plan = collectionWritePlan({
      sentBody: input.body,
      currentBody: typeof base.body === 'string' ? base.body : current.body,
      modules,
    })
    if (plan.rejectBody) {
      throw createError({ statusCode: 400, statusMessage: COLLECTION_BODY_REJECTED })
    }
    const items = mergedPresent(input.items, base, 'items')
    const kind = mergedField(input.kind, base, 'kind', current.kind)
    const pendingStatus = pendingPublication(input.publicationStatus)
    const payload: Record<string, unknown> = {
      slug,
      title: input.title ?? (typeof base.title === 'string' ? base.title : current.title),
      summary: mergedField(input.summary, base, 'summary', current.summary),
      body: plan.body ?? mergedField(input.body, base, 'body', current.body),
      seoTitle: mergedField(input.seoTitle, base, 'seoTitle', current.seoTitle),
      seoDescription: mergedField(input.seoDescription, base, 'seoDescription', current.seoDescription),
      ogImage: mergedField(input.ogImage, base, 'ogImage', current.ogImage),
      noindex: mergedField(input.noindex, base, 'noindex', current.noindex),
      kind,
      month: collectionMonth(kind, input, base, current.month),
      sources: mergedField(input.sources, base, 'sources', current.sources ?? []),
      modules,
    }
    if (items.set) {
      payload.items = items.value ?? []
    }
    try {
      if (items.set) {
        await db.editor.assertOrderedStops(items.value ?? [])
      }
      const stored = await savePendingDraftContent({
        entityType: 'collection',
        entityId: current.id,
        publicationStatus: pendingStatus,
        payload,
      }, contentGate('collection', { ...payload, copy: plan.copy }, false))
      await auditMcp(auditTool, 'collection', current.id)
      return {
        id: current.id,
        slug,
        title: String(payload.title),
        publicationStatus: current.publicationStatus,
        kind: payload.kind,
        month: payload.month,
        sources: payload.sources,
        body: payload.body,
        modules: payload.modules,
        article: plan.article,
        items: items.set
          ? await describedStops(items.value ?? [])
          : orderedStopView(await db.editor.collectionItems(current.id)),
        ...pendingDraftFields(String(payload.body ?? ''), pendingStatus, plan.renderedFields, stored.writingWarnings),
      }
    } catch (error) {
      rethrowContentWrite(error)
    }
  }
  const slug = input.slug || current?.slug || ''
  const problem = slugError(slug)
  if (problem || !(input.title ?? current?.title)?.trim()) {
    throw createError({ statusCode: 400, statusMessage: problem || 'Нужны название и адрес' })
  }
  const modules = input.modules === undefined ? current?.modules : input.modules
  const plan = collectionWritePlan({
    sentBody: input.body,
    currentBody: current?.body,
    modules,
  })
  if (plan.rejectBody) {
    throw createError({ statusCode: 400, statusMessage: COLLECTION_BODY_REJECTED })
  }
  try {
    const { row, writingWarnings } = await saveCollectionContent({
      id: current?.id ?? input.id,
      slug,
      title: (input.title ?? current?.title ?? '').trim(),
      summary: input.summary,
      body: plan.body,
      publicationStatus,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      ogImage: input.ogImage,
      noindex: input.noindex,
      items: input.items,
      kind: input.kind,
      month: input.kind === 'theme' ? null : input.month,
      sources: input.sources,
      modules: input.modules,
    }, null, contentGate('collection', {
      title: input.title ?? current?.title,
      summary: input.summary === undefined ? current?.summary : input.summary,
      copy: plan.copy,
      seoTitle: input.seoTitle === undefined ? current?.seoTitle : input.seoTitle,
      seoDescription: input.seoDescription === undefined ? current?.seoDescription : input.seoDescription,
      items: input.items,
      sources: input.sources === undefined ? current?.sources : input.sources,
    }, publicationStatus === 'published'))
    if (scope === 'editor' && current) {
      await db.editor.deleteContentDraft('collection', current.id)
    }
    await auditMcp(auditTool, 'collection', row.id)
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      publicationStatus: row.publicationStatus,
      kind: row.kind,
      month: row.month,
      sources: row.sources,
      body: row.body,
      modules: row.modules,
      article: plan.article,
      renderedFields: plan.renderedFields,
      items: orderedStopView(await db.editor.collectionItems(row.id)),
      pendingReview: false as const,
      writingWarnings,
    }
  } catch (error) {
    rethrowContentWrite(error)
  }
}

export async function readCollection(input: { id?: string, slug?: string }) {
  const rows = await db.editor.listCollections()
  const row = rows.find((item) => item.id === input.id || item.slug === input.slug)
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Подборка не найдена' })
  }
  const draft = await db.editor.contentDraft('collection', row.id)
  return {
    ...collectionView(row, await db.editor.collectionItems(row.id)),
    pendingReview: draft
      ? {
          publicationStatus: draft.publicationStatus,
          updatedAt: draft.updatedAt,
          payload: draft.payload,
        }
      : null,
  }
}
