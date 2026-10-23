import { z } from 'zod'
import { ADMISSION_EXTRAS_UNKNOWN, ADMISSION_UNKNOWN } from '../../../shared/admission'
import { defineStrictMcpTool } from '../../utils/mcp/tool'
import { admissionExtrasWriteEnabled, readAdmission } from '../../utils/practical/admission'
import { practicalTarget } from '../../utils/practical/target'

export default defineStrictMcpTool({
  name: 'admission_get',
  description: 'Load entry rows and separate extras (ADRs 0046, 0050); shownExtras/extrasStored describe extras, and extrasWriteEnabled reports rollout availability. Extras never change entry fallback or markup. Load the ticket list (ADR 0046) of a place, venue, or route: every stored row, and the slots the page shows. A row whose checkedAt is older than 365 days is stored but hidden. When rows exist and none is fresh, the page says «Стоимость билета уточняйте» instead of places.price.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    subjectType: z.enum(['place', 'venue', 'route']).default('place'),
    id: z.string().optional(),
    slug: z.string().optional(),
  },
  handler: async ({ subjectType, id, slug }) => {
    const target = await practicalTarget(subjectType, id, slug)
    const admission = await readAdmission(target)
    return {
      subjectType,
      id: target.id,
      slug: target.slug,
      status: target.status,
      ...admission,
      extrasWriteEnabled: admissionExtrasWriteEnabled(),
      shownSlots: admission.shown,
      shownExtraSlots: admission.shownExtras,
      extrasFallback: admission.extrasStored && !admission.shownExtras.length ? ADMISSION_EXTRAS_UNKNOWN : null,
      fallback: admission.stored && !admission.shown.length ? ADMISSION_UNKNOWN : null,
    }
  },
})
