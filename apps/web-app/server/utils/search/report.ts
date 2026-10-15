import { db } from '@k39/database'
import { resolvePeriod } from '../../../shared/analytics'

/** Site search report for MCP and /admin/search (ADR 0030). */
export async function searchReport(period?: string) {
  const range = resolvePeriod(period || '28d')
  const report = await db.search.report(range.from, range.to)
  return { period: range.label, from: range.from.toISOString(), to: range.to.toISOString(), ...report }
}

export async function searchZeroResults(period?: string, limit = 50) {
  const range = resolvePeriod(period || '28d')
  return { period: range.label, queries: await db.search.zeroResults(range.from, range.to, limit) }
}
