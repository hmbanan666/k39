import { ingest } from '../utils/analytics/ingest'

interface ClientEvent {
  type?: string
  path?: string
  ref?: string
  w?: string | number
  lang?: string
  ms?: number
  scroll?: number | string
  target?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ events?: ClientEvent[] }>(event).catch(() => null)
  const events = Array.isArray(body?.events) ? body.events : []
  return ingest(event, events, 'beacon')
})
