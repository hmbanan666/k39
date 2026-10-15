import { requireEditor } from '../../utils/access'
import { searchReport } from '../../utils/search/report'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const query = getQuery(event)
  return searchReport(typeof query.period === 'string' ? query.period : '28d')
})
