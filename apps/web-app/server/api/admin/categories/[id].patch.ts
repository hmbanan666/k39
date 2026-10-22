import { requireEditor } from '../../../utils/access'
import { saveAdminHub } from '../../../utils/admin/hub'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const body = await readJsonBody(event)
  return saveAdminHub(String(getRouterParam(event, 'id')), body ?? {})
})
