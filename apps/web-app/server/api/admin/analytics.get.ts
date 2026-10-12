import { requireEditor } from '../../utils/access'
import { analyticsReport } from '../../utils/analytics/report'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const query = getQuery(event)
  return analyticsReport(typeof query.period === 'string' ? query.period : '28d')
})
