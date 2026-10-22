import { db } from '@k39/database'
import { createError } from 'h3'
import { COLLECTION_BODY_REJECTED, collectionWritePlan } from '../../../shared/page-modules'
import { slugError } from '../../../shared/seo'
import { withPendingGuard } from '../content/pending-guard'
import { contentGate, saveCollectionContent } from '../content/save'

/**
 * Admin collection save. Modules are the article: `body` is stored as their
 * projection, and a different body is rejected. Same plan as `saveCollectionDraft`.
 */
export async function saveAdminCollection(id: string, body: Record<string, unknown>, userId: string | null) {
  const problem = slugError(String(body.slug || ''))
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
  const current = (await db.editor.listCollections()).find((item) => item.id === id)
  const modules = body.modules === undefined ? current?.modules : body.modules
  const plan = collectionWritePlan({
    sentBody: typeof body.body === 'string' ? body.body : undefined,
    currentBody: current?.body,
    modules,
  })
  if (plan.rejectBody) {
    throw createError({ statusCode: 400, statusMessage: COLLECTION_BODY_REJECTED })
  }
  return withPendingGuard('collection', id, body.pendingDraft, async (tx) => {
    const { row, writingWarnings } = await saveCollectionContent({
      ...body,
      body: plan.body,
      modules,
      id,
    } as Parameters<typeof saveCollectionContent>[0], userId, contentGate('collection', {
      title: body.title,
      summary: body.summary,
      copy: plan.copy,
      seoTitle: body.seoTitle,
      seoDescription: body.seoDescription,
      sources: body.sources === undefined ? current?.sources : body.sources,
      items: body.items,
    }, body.publicationStatus === 'published'), tx)
    return { ...row, writingWarnings, article: plan.article, renderedFields: plan.renderedFields }
  })
}
