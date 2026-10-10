import { db } from '@k39/database'
import { slugError } from '../../../../shared/seo'
import { requireEditor } from '../../../utils/access'

export default defineEventHandler(async (event) => {
  const user = await requireEditor(event)
  const body = await readBody(event)
  const problem = slugError(String(body.slug || ''))
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
  return db.editor.saveRoute({ ...body, id: String(getRouterParam(event, 'id')) }, user.id)
})
