import { createError } from 'h3'
import { requireEditor } from '../../../../utils/access'
import { applyAdminContentDraft, discardAdminContentDraft } from '../../../../utils/admin/content-draft'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const id = String(getRouterParam(event, 'id'))
  const body = await readJsonBody(event)
  if (body?.action === 'apply') {
    return applyAdminContentDraft('route', id)
  }
  if (body?.action === 'discard') {
    return discardAdminContentDraft('route', id)
  }
  throw createError({ statusCode: 400, statusMessage: 'Нужно действие: применить или отбросить' })
})
