import { requireEditor } from '../../../utils/access'
import { saveAdminPlace } from '../../../utils/admin/place-draft'

export default defineEventHandler(async (event) => {
  const user = await requireEditor(event)
  const id = String(getRouterParam(event, 'id'))
  const body = await readBody(event)
  return saveAdminPlace(id, body ?? {}, user.id)
})
