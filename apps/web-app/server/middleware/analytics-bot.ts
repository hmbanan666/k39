import { isBotUserAgent } from '../../shared/analytics'
import { ingest } from '../utils/analytics/ingest'

export default defineEventHandler(async (event) => {
  if (event.method !== 'GET') {
    return
  }
  const path = event.path.split('?')[0] || ''
  if (
    path.startsWith('/api') ||
    path.startsWith('/admin') ||
    path.startsWith('/_') ||
    path.startsWith('/mcp') ||
    path.includes('.')
  ) {
    return
  }
  const accept = getHeader(event, 'accept') || ''
  if (!accept.includes('text/html')) {
    return
  }
  const ua = getHeader(event, 'user-agent') || ''
  if (!isBotUserAgent(ua)) {
    return
  }
  await ingest(
    event,
    [
      {
        type: 'pageview',
        path: event.path,
        ref: getHeader(event, 'referer') || '',
      },
    ],
    'server',
  ).catch(() => undefined)
})
