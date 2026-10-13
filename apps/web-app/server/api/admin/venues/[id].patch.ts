import { requireEditor } from '../../../utils/access'
import { updateVenue } from '../../../utils/venues/mutate'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const body = await readBody(event)
  return updateVenue({ ...body, id: String(getRouterParam(event, 'id') || '') }, { audit: false })
})
