import { z } from 'zod'
import { NOTICE_MAX, NOTICE_SUBJECT_TYPES, noticeInputSchema } from '../../../shared/notices'
import { defineStrictMcpTool } from '../../utils/mcp/tool'
import { setNotices } from '../../utils/notices/write'

export default defineStrictMcpTool({
  name: 'notices_set',
  description: `Replace the dated temporary notices of a place or venue (ADR 0049). Routes and collections have none. Send the whole list: a row with id updates that row, a row without id is inserted, a stored row missing from the list is deleted, and [] clears the subject. At most ${NOTICE_MAX} rows, including rows already expired, so delete before adding a fifth. Kinds: relocation (operating at another address for the window; address required; the stored address, the address fact, and the map pin stay), closed (no visitors and no replacement hours; while current the status line and the availability API say closed), renovation (work underway, the page is still that place; outside view goes in text; no status change), other (a dated statement that is none of those; text carries the fact). from and to are inclusive YYYY-MM-DD. For an opening on day D send to = D minus one. to is null only with openEndedReason (what the source withheld); such a row shows until someone sets to. Without a start date in the source, from is checkedAt. closed and renovation cannot overlap, and two rows of one kind cannot; a row that already ended takes no part. text is Russian, 1 to 160 characters: the page prints the dates, so no «пока», «сейчас», «скоро», «временно», «сегодня», «завтра», «вчера», «на днях», no clock, no ruble amount. The stop-list runs on text, address, and openEndedReason. sourceUrl is the official site; a venue may also cite its own VK community from socials (vk_community_id for a numeric wall URL). A map card, OSM, an aggregator, and a file host are refused. Do not add hours or schedule exceptions for the window, and do not write the temporary address into the venue. The editor token writes the live table and drops the pending draft it saw, notices and all other keys (draftDropped: true); a newer draft stays. The draft token on a published or archived place, or a published or closed venue, stores the list on the pending draft under notices (pendingReview: true) and the page stays; an archived venue is 409. Apply is the editor content_set_publication with published. Writes an mcp_audits row.`,
  inputSchema: {
    subjectType: z.enum(NOTICE_SUBJECT_TYPES),
    id: z.string().optional(),
    slug: z.string().optional(),
    notices: z.array(noticeInputSchema).max(NOTICE_MAX),
  },
  handler: async ({ subjectType, id, slug, notices }) => setNotices({ subjectType, id, slug, notices }, 'mcp'),
})
