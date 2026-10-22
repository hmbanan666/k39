import { db } from '@k39/database'
import { auditedAnalytics } from '../../utils/analytics/report'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'analytics_realtime',
  description: 'Visitors, sessions, and pageviews in the last 30 minutes.',
  annotations: { readOnlyHint: true },
  inputSchema: {},
  handler: async () => auditedAnalytics('analytics_realtime', async () => db.analytics.realtime()),
})
