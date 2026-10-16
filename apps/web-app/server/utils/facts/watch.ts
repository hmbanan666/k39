import { db } from '@k39/database'
import { backoffUntil, decideWatch, WATCH_BATCH } from '../../../shared/facts'
import { fetchWatchable } from './fetch'

function dayStamp(date: Date) {
  return date.toISOString().slice(0, 10)
}

export async function watchSources(now = new Date()) {
  const claimed = await db.analytics.claimRun(dayStamp(now), 'source-watch')
  if (!claimed) {
    return { skipped: true, fetched: 0 }
  }
  const due = await db.facts.dueSources(WATCH_BATCH, now.toISOString())
  let fetched = 0
  for (const row of due) {
    if (fetched > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    await watchOne(row, now)
    fetched += 1
  }
  return { skipped: false, fetched }
}

async function watchOne(row: {
  url: string
  content_hash: string | null
  etag: string | null
  fetched_at: string | null
  fail_count: number
  ttl_days: number
}, now: Date) {
  const result = await fetchWatchable(row.url, row.etag)
  const decision = decideWatch({
    status: result.status || null,
    error: result.error,
    previousHash: row.content_hash,
    nextHash: result.hash,
    failCount: row.fail_count,
  })
  const ttlMs = Math.max(1, row.ttl_days) * 86_400_000
  if (decision.type === 'backoff') {
    await db.facts.recordSource({
      url: row.url,
      contentHash: row.content_hash,
      etag: row.etag,
      lastModified: null,
      httpStatus: result.status || null,
      fetchedAt: row.fetched_at,
      nextFetchAt: backoffUntil(now, decision.delayDays),
      failCount: decision.failCount,
    })
    if (decision.queue) {
      await queueFacts(row.url, 'fetch_failed')
    }
    return
  }
  if (decision.type === 'gone') {
    await db.facts.recordSource({
      url: row.url,
      contentHash: row.content_hash,
      etag: result.etag,
      lastModified: result.lastModified,
      httpStatus: result.status,
      fetchedAt: now.toISOString(),
      nextFetchAt: new Date(now.getTime() + ttlMs).toISOString(),
      failCount: 0,
    })
    await queueFacts(row.url, 'source_gone')
    return
  }
  const hash = decision.type === 'renew' ? (result.hash ?? row.content_hash) : result.hash
  await db.facts.recordSource({
    url: row.url,
    contentHash: hash,
    etag: result.etag,
    lastModified: result.lastModified,
    httpStatus: result.status,
    fetchedAt: now.toISOString(),
    nextFetchAt: new Date(now.getTime() + ttlMs).toISOString(),
    failCount: 0,
  })
  if (decision.type === 'renew') {
    await db.facts.renewUrl(row.url, now.toISOString(), row.fetched_at)
    return
  }
  if (decision.type === 'changed') {
    await queueFacts(row.url, 'source_changed')
  }
}

async function queueFacts(url: string, reason: 'source_changed' | 'fetch_failed' | 'source_gone') {
  const rows = await db.facts.forUrl(url)
  for (const fact of rows) {
    if (fact.sourceKind !== 'official' && fact.sourceKind !== 'official_social') {
      continue
    }
    await db.facts.enqueue({
      target: 'fact',
      factId: fact.id,
      pageType: fact.subjectType,
      entityId: fact.subjectId,
      path: fact.slot,
      reason,
      priority: 1,
    })
  }
}
