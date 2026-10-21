import { Buffer } from 'node:buffer'
import { normalizeCollectEvents } from '../utils/analytics/collect'
import { ingest } from '../utils/analytics/ingest'

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

export default defineEventHandler(async (event) => {
  const referer = getHeader(event, 'referer') || ''
  let path = '/'
  try {
    const url = new URL(referer)
    path = `${url.pathname}${url.search}`
  } catch {
    path = '/'
  }
  const events = normalizeCollectEvents([{ type: 'pageview', path }])
  await ingest(event, events, 'noscript').catch(() => undefined)
  setHeader(event, 'content-type', 'image/gif')
  setHeader(event, 'cache-control', 'no-store')
  return GIF
})
