import { requireEditor } from '../../../utils/access'
import { createVenue } from '../../../utils/venues/write'

export default defineEventHandler(async (event) => {
  const user = await requireEditor(event)
  const body = await readBody(event)
  return createVenue(body, user.id)
})
