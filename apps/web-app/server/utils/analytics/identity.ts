import { createHmac, randomBytes } from 'node:crypto'
import process from 'node:process'

export function dailyVisitorKey(salt: string, day: string, ip: string, ua: string) {
  return createHmac('sha256', salt).update(`${day}\n${ip}\n${ua}`).digest('hex').slice(0, 32)
}

export function newVisitorKey() {
  return randomBytes(16).toString('hex')
}

export function analyticsSalt() {
  return process.env.ANALYTICS_SALT || process.env.NUXT_SESSION_PASSWORD || 'k39-analytics-dev'
}
