import { submitGuestText } from '../../utils/guests/submit'

// A review is at most 1200 characters, plus the consent and subject fields.
const GUEST_BODY_MAX = 16 * 1024

export default defineEventHandler(async (event) => {
  const body = await readCappedJson(event, GUEST_BODY_MAX, 'Сообщение слишком большое.')
  return submitGuestText(event, body ?? {})
})
