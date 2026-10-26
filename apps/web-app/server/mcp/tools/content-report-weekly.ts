import { z } from 'zod'
import { defineStrictMcpTool } from '../../utils/mcp/tool'
import { auditedScore, refreshContentScores, weeklyContentReport } from '../../utils/scoring/run'

export default defineStrictMcpTool({
  name: 'content_report_weekly',
  description:
    'Weekly content report: average score versus the snapshot from seven days ago, top and bottom pages, pages under their organic goal, the largest drops, pages with a length override plus their organic visits and search impressions, the open verification queue by reason, and the ten highest-priority rows. A page under its 30-day goal that is also in the queue is listed. The report reads the queue and does not recompute facts. refresh true recomputes scores first.',
  inputSchema: {
    refresh: z.boolean().optional(),
  },
  handler: async ({ refresh }) =>
    auditedScore('content_report_weekly', null, async () => {
      if (refresh) {
        await refreshContentScores({ force: true })
      }
      return weeklyContentReport()
    }),
})
