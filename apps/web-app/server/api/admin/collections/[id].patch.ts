import { db } from '@k39/database'
import { COLLECTION_BODY_REJECTED, collectionWritePlan } from '../../../../shared/page-modules'
import { slugError } from '../../../../shared/seo'
import { requireEditor } from '../../../utils/access'
import { withPendingGuard } from '../../../utils/admin/content-draft'
import { contentGate, saveCollectionContent } from '../../../utils/content/save'

export default defineEventHandler(async (event) => {
  const user = await requireEditor(event)
  const body = await readBody(event)
  const problem = slugError(String(body.slug || ''))
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
  const id = String(getRouterParam(event, 'id'))
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
  return withPendingGuard('collection', id, body?.pendingDraft, async () => {
    const { row, writingWarnings } = await saveCollectionContent({ ...body, body: plan.body, modules, id }, user.id, contentGate('collection', {
      title: body.title,
      summary: body.summary,
      copy: plan.copy,
      seoTitle: body.seoTitle,
      seoDescription: body.seoDescription,
      sources: body.sources === undefined ? current?.sources : body.sources,
      items: body.items,
    }, body.publicationStatus === 'published'))
    return { ...row, writingWarnings, article: plan.article, renderedFields: plan.renderedFields }
  })
})
