import { db } from '@k39/database'
import { z } from 'zod'

export default defineMcpTool({
  name: 'schedules_list',
  description: 'List schedules with their verification state, so unverified or needsCheck rows can be checked against official sources.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    entityType: z.enum(['place', 'venue']).optional(),
    needsCheck: z.boolean().optional(),
  },
  handler: async ({ entityType, needsCheck }) => {
    const rows = await db.schedules.list(entityType)
    const items = rows.map((row) => ({
      entityType: row.entityType,
      entityId: row.entityId,
      mode: (row.rules as { mode?: string }).mode ?? null,
      needsCheck: Boolean((row.rules as { needsCheck?: boolean }).needsCheck) || !row.verifiedAt,
      verifiedAt: row.verifiedAt,
      sourceUrl: row.sourceUrl,
    }))
    return { items: needsCheck == null ? items : items.filter((item) => item.needsCheck === needsCheck) }
  },
})
