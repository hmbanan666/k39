import { requireEditor } from '../../../../utils/access'
import { adminPlaceDraftView } from '../../../../utils/admin/place-draft'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const id = String(getRouterParam(event, 'id'))
  return adminPlaceDraftView(id)
})
