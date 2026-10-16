import { db } from '@k39/database'
import { GUEST_CONSENT_VERSION } from '../../../../../shared/consent'
import { requireEditor } from '../../../../utils/access'
import { removeGuestMedia } from '../../../../utils/guests/moderate'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }
  const row = await db.consent.withdraw(id)
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Consent not found' })
  }
  if (row.version === GUEST_CONSENT_VERSION) {
    const mediaIds = await db.guests.clearUser(row.userId)
    await removeGuestMedia(mediaIds)
  }
  return { id: row.id, withdrawnAt: row.withdrawnAt }
})
