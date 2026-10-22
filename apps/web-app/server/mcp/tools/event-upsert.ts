import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'
import { eventInput, upsertEvent } from '../../utils/practical/events'
import { practicalTarget } from '../../utils/practical/target'

export default defineMcpTool({
  name: 'event_upsert',
  description: 'Create or update one dated performance (ADR 0046) on a place or venue. Omit id to create. title up to 120 characters. With a clock: startsAt and optional endsAt as local YYYY-MM-DDTHH:mm in Europe/Kaliningrad; endsAt after startsAt. With a date only (allDay true): startsOn and optional endsOn as YYYY-MM-DD; never guess a clock. A past event is refused. sourceUrl is the official page of the place or its own social page that lists the event; a listing site is not a source. ticketUrl is an https seller link only when that official page links to it, or the place\'s own box office. checkedAt is the YYYY-MM-DD you read the source. remove true with id cancels: the row stays for history, the fact retires, and the page drops it. A weekly series is a schedule, not events. Expired and cancelled rows never render. A draft token on a published or archived place or a published or closed venue gets 409 and nothing is stored. Writes an mcp_audits row.',
  inputSchema: {
    subjectType: z.enum(['place', 'venue']).default('place'),
    subjectId: z.string().optional(),
    slug: z.string().optional(),
    id: z.string().optional(),
    remove: z.boolean().optional(),
    event: eventInput.optional(),
  },
  handler: async ({ subjectType, subjectId, slug, id, remove, event }) => {
    const target = await practicalTarget(subjectType, subjectId, slug)
    const saved = await upsertEvent(target, { id, remove, event }, 'mcp')
    await auditMcp('event_upsert', subjectType, target.id)
    return { subjectType, subjectId: target.id, slug: target.slug, ...saved }
  },
})
