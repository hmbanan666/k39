import { db } from '@k39/database'
import { slugError } from '../../../../shared/seo'
import { writingCopy } from '../../../../shared/writing'
import { requireEditor } from '../../../utils/access'
import { writingGate } from '../../../utils/mcp/writing-guard'

export default defineEventHandler(async (event) => {
  const user = await requireEditor(event)
  const body = await readBody(event)
  const problem = slugError(String(body.slug || ''))
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
  const writingWarnings = writingGate(writingCopy([
    body.title,
    body.summary,
    body.body,
    body.seoTitle,
    body.seoDescription,
  ]), body.publicationStatus === 'published')
  const row = await db.editor.saveRoute({ ...body, id: String(getRouterParam(event, 'id')) }, user.id)
  return { ...row, writingWarnings }
})
