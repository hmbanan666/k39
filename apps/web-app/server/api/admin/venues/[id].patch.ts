import { requireEditor } from '../../../utils/access'
import { updateVenue } from '../../../utils/venues/write'

export default defineEventHandler(async (event) => {
  const user = await requireEditor(event)
  const body = await readJsonBody(event)
  return updateVenue({ ...body, id: getRouterParam(event, 'id') || '' }, user.id)
})
