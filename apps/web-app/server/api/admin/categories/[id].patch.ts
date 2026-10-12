import { db } from '@k39/database'
import { requireEditor } from '../../../utils/access'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const body = await readBody(event)
  return db.editor.saveCategory(String(getRouterParam(event, 'id')), {
    title: String(body.title || ''),
    description: String(body.description || ''),
    body: body.body == null ? undefined : String(body.body),
    seoTitle: body.seoTitle || null,
    seoDescription: body.seoDescription || null,
    ogImage: body.ogImage || null,
    noindex: Boolean(body.noindex),
  })
})
