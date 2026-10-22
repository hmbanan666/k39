import { requireEditor } from '../../../utils/access'
import { saveAdminCollection } from '../../../utils/admin/collection-write'

export default defineEventHandler(async (event) => {
  const user = await requireEditor(event)
  const id = String(getRouterParam(event, 'id'))
  const body = await readJsonBody(event)
  return saveAdminCollection(id, body ?? {}, user.id)
})
