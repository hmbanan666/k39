import process from 'node:process'
import { takeContentSlot } from '../mcp/rate-limit'
import { requireContentToken } from '../utils/access'

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  if (path !== '/mcp' && !path.startsWith('/mcp/')) {
    return
  }
  if (event.method === 'OPTIONS') {
    return
  }
  requireContentToken(event)
  takeContentSlot(process.env.CONTENT_API_TOKEN || '')
})
