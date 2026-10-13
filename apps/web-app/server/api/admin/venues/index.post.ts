import { requireEditor } from '../../../utils/access'
import { createVenue } from '../../../utils/venues/mutate'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const body = await readBody(event)
  return createVenue(body, { audit: false })
})
