import { submitGuestText } from '../../utils/guests/submit'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return submitGuestText(event, body ?? {})
})
