import { Buffer } from 'node:buffer'
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
  await ingest(event, [{ type: 'pageview', path }], 'noscript').catch(() => undefined)
  setHeader(event, 'content-type', 'image/gif')
  setHeader(event, 'cache-control', 'no-store')
  return GIF
})
