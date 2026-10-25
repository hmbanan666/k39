import pg from 'pg'
import { prepareSourceLinks, SourceInputError } from './sources'

export const SOURCE_AUDIT_LIMITS = {
  records: 10_000,
  problems: 100,
  sourceBytes: 65_536,
  connectMs: 5_000,
  queryMs: 10_000,
  cleanupMs: 3_000,
} as const

interface AuditClient {
  connect: () => Promise<unknown>
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[], command?: string }>
  end: () => Promise<unknown>
  on: (event: 'error', listener: () => void) => unknown
}

interface SourceProblem {
  entity: string
  id: string
  slug: string | null
  origin: string
  rows?: number
  problem: string
}

export interface SourceAuditReport {
  status: 'complete' | 'blocked' | 'incomplete'
  scanned: number
  problemCount: number
  problems: SourceProblem[]
  problemsTruncated: boolean
  readOnly: boolean
  rollback: boolean
  cleanup: boolean
  failure?: string
  limits: typeof SOURCE_AUDIT_LIMITS
}

// Preserve the checkout report's scope: stored place/collection/venue lists,
// and every pending payload with an explicit sources key (including null).
const scanSql = `
  WITH candidates AS (
    SELECT 'place' AS entity, id, slug, 'stored' AS origin, sources FROM places
    UNION ALL SELECT 'collection', id, slug, 'stored', sources FROM collections
    UNION ALL SELECT 'venue', id, slug, 'stored', sources FROM venues
    UNION ALL SELECT entity_type, entity_id, NULL, 'pending', payload->'sources'
      FROM content_drafts WHERE payload ? 'sources'
  )
  SELECT left(entity, 80) AS entity, left(id, 160) AS id,
    left(slug, 160) AS slug, origin,
    CASE WHEN octet_length(sources::text) <= $1 THEN sources ELSE NULL END AS sources,
    coalesce(octet_length(sources::text) > $1, false) AS oversized
  FROM candidates ORDER BY entity, id, origin LIMIT $2
`

async function bounded<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Audit operation timed out')), milliseconds)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

/** No database singleton, app boot, migrations, writers, or source payload output. */
export async function auditSourceLists(
  databaseUrl: string | undefined,
  createClient: (url: string) => AuditClient = (url) => new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: SOURCE_AUDIT_LIMITS.connectMs,
    query_timeout: SOURCE_AUDIT_LIMITS.queryMs,
    application_name: 'k39-source-list-audit',
  }),
): Promise<SourceAuditReport> {
  const report: SourceAuditReport = {
    status: 'blocked', scanned: 0, problemCount: 0, problems: [],
    problemsTruncated: false, readOnly: false, rollback: false, cleanup: false,
    limits: SOURCE_AUDIT_LIMITS,
  }
  if (!databaseUrl?.trim()) {
    return { ...report, failure: 'missing_database_url' }
  }
  let client: AuditClient | undefined
  let connected = false
  let scanned = false
  let phase = 'connect'
  try {
    client = createClient(databaseUrl)
    client.on('error', () => {
      report.failure ??= 'connection'
    })
    await bounded(client.connect(), SOURCE_AUDIT_LIMITS.connectMs)
    connected = true
    phase = 'begin'
    await bounded(client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'), SOURCE_AUDIT_LIMITS.queryMs)
    // Server limits bound work even after a client-side timeout/disconnection.
    await bounded(client.query('SET LOCAL statement_timeout = \'10s\''), SOURCE_AUDIT_LIMITS.queryMs)
    await bounded(client.query('SET LOCAL lock_timeout = \'2s\''), SOURCE_AUDIT_LIMITS.queryMs)
    await bounded(client.query('SET LOCAL idle_in_transaction_session_timeout = \'15s\''), SOURCE_AUDIT_LIMITS.queryMs)
    phase = 'read_only_assertion'
    const readOnly = await bounded(client.query('SHOW transaction_read_only'), SOURCE_AUDIT_LIMITS.queryMs)
    report.readOnly = readOnly.rows[0]?.transaction_read_only === 'on'
    if (!report.readOnly) {
      throw new Error('Read-only assertion failed')
    }
    phase = 'scan'
    const result = await bounded(client.query(scanSql, [SOURCE_AUDIT_LIMITS.sourceBytes, SOURCE_AUDIT_LIMITS.records + 1]), SOURCE_AUDIT_LIMITS.queryMs)
    if (result.rows.length > SOURCE_AUDIT_LIMITS.records) {
      report.failure = 'record_limit'
    }
    for (const row of result.rows.slice(0, SOURCE_AUDIT_LIMITS.records)) {
      report.scanned += 1
      const sources = row.sources
      let problem: string | undefined
      if (row.oversized) {
        report.failure ??= 'source_byte_limit'
        problem = 'Source list exceeds audit byte limit; not validated'
      } else if (sources != null) {
        if (!Array.isArray(sources) || sources.some((source) => !source || typeof source !== 'object' || typeof source.title !== 'string' || typeof source.url !== 'string')) {
          problem = 'Invalid source list shape'
        } else {
          try {
            prepareSourceLinks(sources)
          } catch (error) {
            if (!(error instanceof SourceInputError)) {
              throw error
            }
            // Canonical errors include a title/URL hint. Never print that data.
            problem = 'Invalid source list'
          }
        }
      }
      if (problem) {
        report.problemCount += 1
        if (report.problems.length < SOURCE_AUDIT_LIMITS.problems) {
          report.problems.push({
            entity: String(row.entity).slice(0, 80), id: String(row.id).slice(0, 160),
            slug: row.slug == null ? null : String(row.slug).slice(0, 160),
            origin: String(row.origin).slice(0, 80),
            ...(Array.isArray(sources) ? { rows: sources.length } : {}), problem,
          })
        }
      }
    }
    report.problemsTruncated = report.problemCount > report.problems.length
    scanned = true
  } catch {
    // Do not expose pg errors: they can contain credentials, SQL or stored data.
    report.failure ??= phase
  } finally {
    if (client) {
      if (connected) {
        try {
          const rollback = await bounded(client.query('ROLLBACK'), SOURCE_AUDIT_LIMITS.queryMs)
          report.rollback = rollback.command === 'ROLLBACK'
          if (!report.rollback) {
            report.failure = 'rollback'
          }
        } catch {
          report.failure = 'rollback'
        }
      }
      try {
        await bounded(client.end(), SOURCE_AUDIT_LIMITS.cleanupMs)
        report.cleanup = true
      } catch {
        report.failure = 'cleanup'
      }
    }
  }
  if (scanned && report.readOnly && report.rollback && report.cleanup) {
    report.status = report.failure ? 'incomplete' : 'complete'
  }
  return report
}

/** Findings are distinct from blocked/incomplete execution. */
export function sourceAuditExitCode(report: SourceAuditReport) {
  return report.status !== 'complete' ? 2 : report.problemCount ? 1 : 0
}
