import { db } from '@k39/database'
import { CONSENT_VERSION } from '../../../shared/consent'
import { requireAccount } from '../../utils/cabinet/account'

export default defineEventHandler(async (event) => {
  const user = await requireAccount(event)
  const consent = await db.consent.active(user.id, CONSENT_VERSION)
  const venues = await db.venueClaims.forUser(user.id)
  return {
    user: { id: user.id, name: user.name, email: user.email },
    consent: consent
      ? { version: consent.version, consentedAt: consent.consentedAt, current: true }
      : { version: CONSENT_VERSION, consentedAt: null, current: false },
    venues: venues.map((row) => ({
      id: row.venueId,
      name: row.name,
      slug: row.slug,
      role: row.role,
      status: row.status,
    })),
  }
})
