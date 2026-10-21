import { sendNoContent } from 'h3'
import { readCollectJson } from '../utils/analytics/collect'
import { ingest } from '../utils/analytics/ingest'

export default defineEventHandler(async (event) => {
  const body = await readCollectJson(event)
  const result = await ingest(event, body, 'beacon')
  if ('skipped' in result && result.skipped === 'rate') {
    sendNoContent(event)
    return
  }
  return result
})
