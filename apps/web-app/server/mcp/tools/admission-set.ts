import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'
import { admissionListInput, setAdmission } from '../../utils/practical/admission'
import { practicalTarget } from '../../utils/practical/target'

export default defineMcpTool({
  name: 'admission_set',
  description: 'Replace the ticket list (ADR 0046) of a place, venue, or route. At most 12 rows. slot is a stable slug [a-z0-9-] up to 40 characters, unique on the subject. audience is general, reduced, family, foreign, or free; the same audience may repeat under another slot. priceRub is a whole number of rubles above 0; free is 0. condition (Russian, up to 200 characters) is required for reduced, family, and foreign, and for free when free entry has a condition; an empty condition on free means the visit is free. label (up to 80) overrides «Взрослый», «Льготный», «Семейный», «Иностранные посетители», «Бесплатно». sourceUrl is the official site of the place, the museum, or the administration that states the amount; a map card, a ticket aggregator, a social page, a guest report, and a document host (Drive, Docs, Yandex Disk) are refused. checkedAt is the YYYY-MM-DD you read that page, not in the future. Never parse places.price into rows and never guess an amount: a missing amount stays off the list. A row left out retires its fact; an empty list clears the table. A draft token on a published or archived place or route, or a published or closed venue, gets 409 and nothing is stored. An editor save is live at once. Writes an mcp_audits row.',
  inputSchema: {
    subjectType: z.enum(['place', 'venue', 'route']).default('place'),
    id: z.string().optional(),
    slug: z.string().optional(),
    rows: admissionListInput,
  },
  handler: async ({ subjectType, id, slug, rows }) => {
    const target = await practicalTarget(subjectType, id, slug)
    const saved = await setAdmission(target, rows, 'mcp')
    await auditMcp('admission_set', subjectType, target.id)
    return { subjectType, id: target.id, slug: target.slug, ...saved }
  },
})
