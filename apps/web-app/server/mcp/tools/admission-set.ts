import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'
import { defineStrictMcpTool } from '../../utils/mcp/tool'
import { admissionExtrasInput, admissionListInput, setAdmission } from '../../utils/practical/admission'
import { practicalTarget } from '../../utils/practical/target'

export default defineStrictMcpTool({
  name: 'admission_set',
  description:
    'Save admission entry rows and/or paid extras (ADRs 0046, 0050) for a place, venue or route. rows: up to 48 entry tariffs; extras: up to 12 paid services. Omitted lists are preserved; [] clears only that list; at least one is required. Slots are stable [a-z0-9-] slugs up to 40 characters, unique within each list. Entry audience: general|reduced|family|foreign|free; integer priceRub > 0, or 0 for free. reduced/family/foreign require a condition; conditional free entry must state its condition. Extras have no audience, require a nonempty label and positive integer priceRub, and unit person|group|device|null (null means unstated, never assume per person). condition records eligibility, group size and any required entry ticket. Label up to 80 characters; condition up to 200. sourceUrl/sourceTitle must be the subject own official site, museum or administration stating the exact amount; no maps, ticket aggregators, socials or document hosts. checkedAt: real YYYY-MM-DD day checked, not in the future. No ranges, guessed amounts or refundable deposits. No parsing places.price. Omitted rows retire facts only in the supplied list; extras do not set entry offers or free access. Draft tokens on a live parent receive 409, nothing pending is stored. Editor writes are live. Extras writes may return 503 while rollout is disabled; read admission_get for extrasWriteEnabled. Writes are atomic with facts and audited.',

  inputSchema: {
    subjectType: z.enum(['place', 'venue', 'route']).default('place'),
    id: z.string().optional(),
    slug: z.string().optional(),
    rows: admissionListInput.optional(),
    extras: admissionExtrasInput.optional(),
  },
  handler: async ({ subjectType, id, slug, rows, extras }) => {
    const target = await practicalTarget(subjectType, id, slug)
    const saved = await setAdmission(target, { rows, extras }, 'mcp')
    await auditMcp('admission_set', subjectType, target.id)
    return { subjectType, id: target.id, slug: target.slug, ...saved }
  },
})
