import { slugError } from '../../../../shared/seo'
import { requireEditor } from '../../../utils/access'
import { saveRouteContent } from '../../../utils/content/save'

export default defineEventHandler(async (event) => {
  const user = await requireEditor(event)
  const body = await readBody(event)
  const problem = slugError(String(body.slug || ''))
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
  const { row, writingWarnings } = await saveRouteContent({ ...body, id: String(getRouterParam(event, 'id')) }, user.id, {
    parts: [body.title, body.summary, body.body, body.seoTitle, body.seoDescription],
    publishing: body.publicationStatus === 'published',
  })
  return { ...row, writingWarnings }
})
