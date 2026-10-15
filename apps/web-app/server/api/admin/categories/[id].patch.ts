import { db } from '@k39/database'
import { writingCopy } from '../../../../shared/writing'
import { requireEditor } from '../../../utils/access'
import { writingGate } from '../../../utils/mcp/writing-guard'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const body = await readBody(event)
  const writingWarnings = writingGate(writingCopy([
    body.title,
    body.description,
    body.body,
    body.seoTitle,
    body.seoDescription,
  ]), true)
  const row = await db.editor.saveCategory(String(getRouterParam(event, 'id')), {
    title: String(body.title || ''),
    description: String(body.description || ''),
    body: body.body == null ? undefined : String(body.body),
    seoTitle: body.seoTitle || null,
    seoDescription: body.seoDescription || null,
    ogImage: body.ogImage || null,
    noindex: Boolean(body.noindex),
  })
  return { ...row, writingWarnings }
})
