import { db } from '@k39/database'
import { priceFreshCutoff } from '@k39/types/freshness'
import { z } from 'zod'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'admissions_list',
  description:
    'List entry and separate extra rows (ADRs 0046, 0050); rows/stale/oldestCheckedAt stay entry-only, extras/staleExtras/oldestExtraCheckedAt describe extras, staleOnly matches either list. List ticket rows (ADR 0046) across places, venues, and routes, grouped by subject, with the oldest checkedAt and how many rows are hidden as older than 365 days. Use it to find tables that need a fresh check against the official site.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    subjectType: z.enum(['place', 'venue', 'route']).optional(),
    staleOnly: z.boolean().optional(),
  },
  handler: async ({ subjectType, staleOnly }) => {
    const rows = await db.admission.list(subjectType)
    const cutoff = priceFreshCutoff()
    const groups = new Map<
      string,
      {
        subjectType: string
        subjectId: string
        rows: number
        stale: number
        oldestCheckedAt: string | null
        extras: number
        staleExtras: number
        oldestExtraCheckedAt: string | null
      }
    >()
    for (const row of rows) {
      const key = `${row.subjectType}:${row.subjectId}`
      const group = groups.get(key) ?? {
        subjectType: row.subjectType,
        subjectId: row.subjectId,
        rows: 0,
        stale: 0,
        oldestCheckedAt: null,
        extras: 0,
        staleExtras: 0,
        oldestExtraCheckedAt: null,
      }
      if (row.kind === 'extra') {
        group.extras += 1
        group.staleExtras += row.checkedAt < cutoff ? 1 : 0
        group.oldestExtraCheckedAt =
          !group.oldestExtraCheckedAt || row.checkedAt < group.oldestExtraCheckedAt
            ? row.checkedAt
            : group.oldestExtraCheckedAt
      } else {
        group.rows += 1
        group.stale += row.checkedAt < cutoff ? 1 : 0
        group.oldestCheckedAt =
          !group.oldestCheckedAt || row.checkedAt < group.oldestCheckedAt ? row.checkedAt : group.oldestCheckedAt
      }
      groups.set(key, group)
    }
    const items = []
    for (const type of ['place', 'venue', 'route']) {
      const ofType = [...groups.values()].filter((group) => group.subjectType === type)
      const subjects = await db.practicalSubjects(
        type,
        ofType.map((group) => group.subjectId),
      )
      for (const group of ofType) {
        const subject = subjects.get(group.subjectId)
        items.push({
          ...group,
          slug: subject?.slug ?? null,
          title: subject?.title ?? null,
          status: subject?.status ?? null,
        })
      }
    }
    return { items: staleOnly ? items.filter((item) => item.stale > 0 || item.staleExtras > 0) : items }
  },
})
