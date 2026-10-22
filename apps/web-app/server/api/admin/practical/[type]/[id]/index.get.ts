import { db } from '@k39/database'
import { eventFormTiming, eventUpcoming } from '../../../../../../shared/events'
import { adminPracticalTarget } from '../../../../../utils/practical/admin'
import { readAdmission } from '../../../../../utils/practical/admission'

export default defineEventHandler(async (event) => {
  const target = await adminPracticalTarget(event)
  const now = new Date()
  const admission = await readAdmission(target, now)
  const events = target.type === 'route' ? [] : await db.calendarEvents.forSubject(target.type, target.id)
  return {
    target,
    admission: admission.rows,
    shownSlots: admission.shown,
    events: events.map((row) => ({ ...row, local: eventFormTiming(row), shown: eventUpcoming(row, now) })),
  }
})
