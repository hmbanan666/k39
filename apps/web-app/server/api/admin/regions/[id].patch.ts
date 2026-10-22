import { db } from '@k39/database'
import { requireEditor } from '../../../utils/access'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const body = await readJsonBody(event)
  return db.editor.saveRegion(String(getRouterParam(event, 'id')), {
    title: String(body.title || ''),
    description: body.description || null,
  })
})
