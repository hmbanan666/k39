import { z } from 'zod'
import { ADMISSION_UNKNOWN } from '../../../shared/admission'
import { readAdmission } from '../../utils/practical/admission'
import { practicalTarget } from '../../utils/practical/target'

export default defineMcpTool({
  name: 'admission_get',
  description: 'Load the ticket list (ADR 0046) of a place, venue, or route: every stored row, and the slots the page shows. A row whose checkedAt is older than 365 days is stored but hidden. When rows exist and none is fresh, the page says «Стоимость билета уточняйте» instead of places.price.',
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
      rows: admission.rows,
      shownSlots: admission.shown,
      fallback: admission.stored && !admission.shown.length ? ADMISSION_UNKNOWN : null,
    }
  },
})
