import { z } from 'zod'
import { auditedScore, refreshContentScores, weeklyContentReport } from '../../utils/scoring/run'

export default defineMcpTool({
  name: 'content_report_weekly',
  description: 'Weekly content report: average score versus the snapshot from seven days ago, top and bottom pages, pages under their organic goal, and the largest drops. refresh true recomputes today first.',
  inputSchema: {
    refresh: z.boolean().optional(),
  },
  handler: async ({ refresh }) => auditedScore('content_report_weekly', null, async () => {
    if (refresh) {
      await refreshContentScores({ force: true })
    }
    return weeklyContentReport()
  }),
})
