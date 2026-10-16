import { requireEditor } from '../../../../../utils/access'
import { dismissGuestSignal } from '../../../../../utils/guests/moderate'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  return dismissGuestSignal(getRouterParam(event, 'id') || '')
})
