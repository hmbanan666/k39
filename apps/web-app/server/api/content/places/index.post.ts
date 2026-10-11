import { requireContentToken } from '../../../utils/access'
import { createPlaceDraft } from '../../../utils/mcp/places'

export default defineEventHandler(async (event) => {
  requireContentToken(event)
  const body = await readBody(event)
  return createPlaceDraft(body)
})
