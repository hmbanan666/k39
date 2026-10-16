import { db } from '@k39/database'
import { COLLECTION_BODY_REJECTED, collectionWritePlan } from '../../../../shared/page-modules'
import { slugError } from '../../../../shared/seo'
import { requireEditor } from '../../../utils/access'
import { saveCollectionContent } from '../../../utils/content/save'

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
  const { row, writingWarnings } = await saveCollectionContent({ ...body, body: plan.body, modules, id }, user.id, {
    parts: [body.title, body.summary, plan.copy, body.seoTitle, body.seoDescription],
    publishing: body.publicationStatus === 'published',
  })
  return { ...row, writingWarnings, article: plan.article, renderedFields: plan.renderedFields }
})
