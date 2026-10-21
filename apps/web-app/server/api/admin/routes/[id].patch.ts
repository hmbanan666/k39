import { slugError } from '../../../../shared/seo'
import { requireEditor } from '../../../utils/access'
import { contentGate, saveRouteContent } from '../../../utils/content/save'

export default defineEventHandler(async (event) => {
  const user = await requireEditor(event)
  const body = await readBody(event)
  const problem = slugError(String(body.slug || ''))
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
  const { row, writingWarnings } = await saveRouteContent({ ...body, id: String(getRouterParam(event, 'id')) }, user.id, contentGate('route', {
    title: body.title,
    summary: body.summary,
    body: body.body,
    sections: body.sections,
    seoTitle: body.seoTitle,
    seoDescription: body.seoDescription,
  }, body.publicationStatus === 'published'))
  return { ...row, writingWarnings }
})
