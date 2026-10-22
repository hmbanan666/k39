import type { AdmissionView } from '../../../shared/admission'
import type { EventLine, EventNodeInput } from '../../../shared/events'
import type { PracticalSubjectType } from './target'
import { db } from '@k39/database'
import { admissionView } from '../../../shared/admission'
import { EVENT_MEMBER_PAGE_LIMIT, EVENT_SUBJECT_PAGE_LIMIT, eventLine } from '../../../shared/events'

export async function loadAdmission(type: PracticalSubjectType, id: string, now = new Date()): Promise<AdmissionView> {
  const rows = await db.admission.forSubject(type, id)
  return admissionView(rows, now)
}

/** Upcoming events of a place or venue. The read compares time itself, so a missed expiry run shows nothing past. */
export async function loadSubjectEvents(type: 'place' | 'venue', id: string, now = new Date()) {
  const rows = await db.calendarEvents.upcomingFor(type, [id], now.toISOString(), EVENT_SUBJECT_PAGE_LIMIT)
  return { rows: rows as Array<EventNodeInput & { id: string }>, lines: rows.map((row) => eventLine(row)) }
}

/** Upcoming events of the published places of a route or collection, each linked to its place. No markup. */
export async function loadMemberEvents(placeIds: string[], now = new Date()): Promise<EventLine[]> {
  const rows = await db.calendarEvents.upcomingForPlaces(placeIds, now.toISOString(), EVENT_MEMBER_PAGE_LIMIT)
  return rows.map((row) => eventLine(row.event, { title: row.subjectTitle, href: `/${row.subjectSlug}` }))
}
