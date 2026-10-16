import { createError } from 'h3'
import { requireEditor } from '../../../../utils/access'
import { applyAdminPlaceDraft, discardAdminPlaceDraft } from '../../../../utils/admin/place-draft'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const id = String(getRouterParam(event, 'id'))
  const body = await readBody(event)
  if (body?.action === 'apply') {
    return applyAdminPlaceDraft(id)
  }
  if (body?.action === 'discard') {
    return discardAdminPlaceDraft(id)
  }
  throw createError({ statusCode: 400, statusMessage: 'Нужно действие: применить или отбросить' })
})
