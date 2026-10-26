import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import pg from 'pg'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { useDatabase } from '../../database'
import { auditSourceLists, SOURCE_AUDIT_LIMITS, sourceAuditExitCode } from '../../source-audit'

const exec = promisify(execFile)
const root = resolve(import.meta.dirname, '../../../../..')
const source = 'apps/web-app/scripts/report-source-lists.ts'
const artifact = 'apps/web-app/.output/server/audits/report-source-lists.mjs'
const secret = 'never-print-source-secret'

function fakeClient(rows: Record<string, unknown>[] = []) {
  return {
    connect: vi.fn(async () => {}),
    end: vi.fn(async () => {}),
    on: vi.fn(),
    query: vi.fn(async (text: string) => ({
      rows: text.startsWith('SHOW') ? [{ transaction_read_only: 'on' }] : text.includes('WITH candidates') ? rows : [],
      command: text === 'ROLLBACK' ? 'ROLLBACK' : 'SELECT',
    })),
  }
}

const candidate = (sources: unknown) => ({
  entity: 'place',
  id: 'audit-place',
  slug: 'audit-place',
  origin: 'stored',
  sources,
})
const links = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ title: `${secret}-${index}`, url: `https://example.org/${index}` }))

describe('bounded source audit outcomes', () => {
  it.each([undefined, '', '  '])(
    'refuses a missing explicit URL without connecting or using PG defaults: %j',
    async (url) => {
      const factory = vi.fn()
      const report = await auditSourceLists(url, factory)
      expect(factory).not.toHaveBeenCalled()
      expect(report).toMatchObject({
        status: 'blocked',
        scanned: 0,
        readOnly: false,
        rollback: false,
        failure: 'missing_database_url',
      })
      expect(sourceAuditExitCode(report)).toBe(2)
    },
  )

  it('keeps null/empty and canonical duplicate/24-row semantics; redacts invalid hints', async () => {
    const duplicates = Array.from({ length: 29 }, (_, index) => ({
      title: secret,
      url: index % 2 ? 'http://www.example.org/page/' : 'https://example.org/page',
    }))
    const client = fakeClient(
      [
        null,
        [],
        duplicates,
        links(24),
        links(25),
        {},
        false,
        0,
        [null],
        [{ title: 2, url: 'https://example.org' }],
        [{ title: secret, url: `ftp://${secret}` }],
      ].map(candidate),
    )
    const report = await auditSourceLists('explicit-url', () => client)
    expect(report).toMatchObject({
      status: 'complete',
      scanned: 11,
      problemCount: 7,
      readOnly: true,
      rollback: true,
      cleanup: true,
    })
    expect(sourceAuditExitCode(report)).toBe(1)
    expect(JSON.stringify(report)).not.toContain(secret)
    expect(report.problems[0]).toMatchObject({ rows: 25, problem: 'Invalid source list' })
  })

  it('does not scan when the read-only assertion fails, and still rolls back/closes', async () => {
    const client = fakeClient()
    client.query.mockImplementation(async () => ({ rows: [{ transaction_read_only: 'off' }], command: 'ROLLBACK' }))
    const report = await auditSourceLists('explicit-url', () => client)
    expect(report).toMatchObject({ status: 'blocked', failure: 'read_only_assertion', rollback: true, cleanup: true })
    expect(client.query.mock.calls.some(([text]) => text.includes('WITH candidates'))).toBe(false)
  })

  it.each(['connect', 'scan', 'rollback', 'cleanup'])(
    'reports %s failures without secrets and always attempts available cleanup',
    async (failure) => {
      const client = fakeClient()
      const error = new Error(`postgres://user:${secret}@host/db`)
      if (failure === 'connect') {
        client.connect.mockRejectedValue(error)
      } else if (failure === 'cleanup') {
        client.end.mockRejectedValue(error)
      } else {
        const query = client.query.getMockImplementation()!
        client.query.mockImplementation(async (text) => {
          if (
            (failure === 'scan' && text.includes('WITH candidates')) ||
            (failure === 'rollback' && text === 'ROLLBACK')
          ) {
            throw error
          }
          return query(text)
        })
      }
      const report = await auditSourceLists('explicit-url', () => client)
      expect(report.status).not.toBe('complete')
      expect(report.failure).toBe(failure)
      expect(sourceAuditExitCode(report)).toBe(2)
      expect(JSON.stringify(report)).not.toContain(secret)
      expect(client.end).toHaveBeenCalledOnce()
      if (failure !== 'connect') {
        expect(client.query).toHaveBeenCalledWith('ROLLBACK')
      }
    },
  )

  it('bounds returned problems and declares a capped scan incomplete', async () => {
    const client = fakeClient(Array.from({ length: SOURCE_AUDIT_LIMITS.records + 1 }, () => candidate(false)))
    const report = await auditSourceLists('explicit-url', () => client)
    expect(report).toMatchObject({
      status: 'incomplete',
      scanned: SOURCE_AUDIT_LIMITS.records,
      problemCount: SOURCE_AUDIT_LIMITS.records,
      problemsTruncated: true,
      failure: 'record_limit',
      rollback: true,
      cleanup: true,
    })
    expect(report.problems).toHaveLength(SOURCE_AUDIT_LIMITS.problems)
    expect(sourceAuditExitCode(report)).toBe(2)
  })

  it('bounds a stalled query and attempts rollback/cleanup', async () => {
    vi.useFakeTimers()
    try {
      const client = fakeClient()
      const query = client.query.getMockImplementation()!
      client.query.mockImplementation((text) =>
        text.includes('WITH candidates') ? new Promise(() => {}) : query(text),
      )
      const pending = auditSourceLists('explicit-url', () => client)
      await vi.advanceTimersByTimeAsync(SOURCE_AUDIT_LIMITS.queryMs)
      expect(await pending).toMatchObject({ status: 'blocked', failure: 'scan', rollback: true, cleanup: true })
    } finally {
      vi.useRealTimers()
    }
  })
})

async function snapshot() {
  const result = await useDatabase().$client.query(`
    SELECT jsonb_build_object(
      'places', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM places t),
      'collections', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM collections t),
      'venues', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM venues t),
      'drafts', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM content_drafts t),
      'audits', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM mcp_audits t),
      'revisions', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM revisions t),
      'facts', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM facts t)
    ) AS state
  `)
  return result.rows[0].state
}

function testUrl() {
  return useDatabase().$client.options.connectionString!
}

async function cli(args: string[], databaseUrl?: string) {
  const env = { ...process.env }
  delete env.DATABASE_URL
  if (databaseUrl !== undefined) {
    env.DATABASE_URL = databaseUrl
  }
  let stdout: string
  let stderr: string
  let code = 0
  try {
    ;({ stdout, stderr } = await exec(args[0]!, args.slice(1), { cwd: root, env, timeout: 25_000 }))
  } catch (error) {
    const result = error as { code: number; stdout: string; stderr: string }
    code = result.code
    stdout = result.stdout
    stderr = result.stderr
  }
  expect(stderr).toBe('')
  return { code, report: JSON.parse(stdout!) }
}

describe('postgres source audit and standalone entry point', () => {
  beforeAll(async () => {
    await exec(process.execPath, ['scripts/build-source-audit.mjs'], { cwd: root })
  })

  afterEach(async () => {
    const pool = useDatabase().$client
    await pool.query("DELETE FROM content_drafts WHERE id LIKE 'source-audit-%'")
    for (const table of ['places', 'collections', 'venues']) {
      await pool.query(`DELETE FROM ${table} WHERE id LIKE 'source-audit-%'`)
    }
  })

  it('runs source and packaged CLI consistently, with no implicit database fallback', async () => {
    const before = await snapshot()
    const packaged = await cli([process.execPath, artifact], testUrl())
    expect(packaged).toMatchObject({
      code: 0,
      report: { status: 'complete', scanned: 0, readOnly: true, rollback: true, cleanup: true },
    })
    const checkout = await cli([process.execPath, '--import', 'jiti/register', source], testUrl())
    expect(checkout).toEqual(packaged)
    const missing = await cli([process.execPath, artifact])
    expect(missing).toMatchObject({
      code: 2,
      report: { failure: 'missing_database_url', status: 'blocked', scanned: 0 },
    })
    expect(await cli([process.execPath, '--import', 'jiti/register', source])).toEqual(missing)
    expect(await snapshot()).toEqual(before)
  })

  it('scans all original stored/pending origins, malformed JSON and canonical duplicates without changing live/draft/audit state', async () => {
    const pool = useDatabase().$client
    await pool.query(
      "INSERT INTO places(id, slug, title, body, sources) VALUES ('source-audit-place','source-audit-place','Тест',$1,$2)",
      [secret, JSON.stringify(links(25))],
    )
    await pool.query(
      "INSERT INTO collections(id, slug, title, sources) VALUES ('source-audit-collection','source-audit-collection','Тест','false')",
    )
    const duplicates = Array.from({ length: 29 }, (_, index) => ({
      title: secret,
      url: index % 2 ? 'http://www.example.org/page/' : 'https://example.org/page',
    }))
    await pool.query(
      "INSERT INTO venues(id, slug, name, kind, sources) VALUES ('source-audit-venue','source-audit-venue','Тест','cafe',$1)",
      [JSON.stringify(duplicates)],
    )
    for (const [suffix, payload] of Object.entries({
      object: { sources: {} },
      zero: { sources: 0 },
      row: { sources: [{ title: false, url: 'https://example.org' }] },
      null: { sources: null },
      omitted: { body: secret },
    })) {
      const id = `source-audit-${suffix}`
      await pool.query("INSERT INTO content_drafts(id,entity_type,entity_id,payload) VALUES ($1,'route',$2,$3)", [
        id,
        id,
        JSON.stringify(payload),
      ])
    }
    const before = await snapshot()
    const packaged = await cli([process.execPath, artifact], testUrl())
    expect(packaged).toMatchObject({
      code: 1,
      report: { status: 'complete', scanned: 7, problemCount: 5, readOnly: true, rollback: true, cleanup: true },
    })
    expect(packaged.report.problems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entity: 'place', origin: 'stored', rows: 25 }),
        expect.objectContaining({ entity: 'collection', origin: 'stored' }),
        expect.objectContaining({ entity: 'route', origin: 'pending' }),
      ]),
    )
    expect(JSON.stringify(packaged)).not.toContain(secret)
    const checkout = await cli([process.execPath, '--import', 'jiti/register', source], testUrl())
    expect(checkout).toEqual(packaged)
    expect(await snapshot()).toEqual(before)
  })

  it('reports an oversized value as incomplete without calling it invalid or transferring its payload', async () => {
    const rows = [{ title: secret.repeat(SOURCE_AUDIT_LIMITS.sourceBytes), url: 'https://example.org' }]
    await useDatabase().$client.query(
      "INSERT INTO places(id,slug,title,sources) VALUES ('source-audit-size','source-audit-size','Тест',$1)",
      [JSON.stringify(rows)],
    )
    const before = await snapshot()
    const report = await auditSourceLists(testUrl())
    expect(report).toMatchObject({
      status: 'incomplete',
      failure: 'source_byte_limit',
      scanned: 1,
      rollback: true,
      cleanup: true,
    })
    expect(JSON.stringify(report)).not.toContain(secret)
    expect(await snapshot()).toEqual(before)
  })

  it('postgres refuses an injected write in the asserted transaction and rolls back without state changes', async () => {
    const before = await snapshot()
    const report = await auditSourceLists(testUrl(), (url) => {
      const client = new pg.Client({ connectionString: url })
      return {
        connect: () => client.connect(),
        end: () => client.end(),
        on: (_event, listener) => client.on('error', listener),
        query: (text, values) =>
          client.query(
            text.includes('WITH candidates')
              ? "INSERT INTO places(id,slug,title) VALUES ('source-audit-forbidden','source-audit-forbidden','Тест')"
              : text,
            values,
          ),
      }
    })
    expect(report).toMatchObject({ status: 'blocked', failure: 'scan', readOnly: true, rollback: true, cleanup: true })
    expect(await snapshot()).toEqual(before)
  })

  it('bounds a real conflicting lock and confirms rollback/cleanup after the failure', async () => {
    const pool = useDatabase().$client
    const before = await snapshot()
    const blocker = await pool.connect()
    try {
      await blocker.query('BEGIN')
      await blocker.query('LOCK TABLE places IN ACCESS EXCLUSIVE MODE')
      const result = await cli([process.execPath, artifact], testUrl())
      expect(result).toMatchObject({
        code: 2,
        report: { status: 'blocked', failure: 'scan', readOnly: true, rollback: true, cleanup: true },
      })
    } finally {
      await blocker.query('ROLLBACK')
      blocker.release()
    }
    expect(await snapshot()).toEqual(before)
  })
})
