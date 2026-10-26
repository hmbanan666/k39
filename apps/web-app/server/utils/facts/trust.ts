import type { TrustCounts } from '../../../shared/facts'
import { db } from '@k39/database'
import { trustOf, unreviewedSections } from '../../../shared/facts'
import { loadPageSnapshots } from './pages'

export async function trustByPath() {
  const pages = await loadPageSnapshots()
  const [freshness, reviews] = await Promise.all([
    db.facts.freshnessByConsumer(new Date().toISOString()),
    db.facts.reviews(),
  ])
  const stale = new Map(freshness.map((row) => [`${row.consumer_type}:${row.consumer_id}`, Number(row.stale)]))
  const reviewed = new Map(reviews.map((row) => [`${row.pageType}:${row.entityId}`, row.sections]))
  const byPage = new Map<string, TrustCounts>()
  for (const page of pages) {
    const stored = reviewed.get(`${page.pageType}:${page.entityId}`) ?? []
    byPage.set(
      `${page.pageType}:${page.entityId}`,
      trustOf({
        staleFacts: stale.get(`${page.pageType}:${page.entityId}`) ?? 0,
        unreviewed: unreviewedSections(page.sections, stored).length,
      }),
    )
  }
  return byPage
}

export async function withTrust<T extends { pageType: string; entityId: string }>(rows: T[]) {
  const trust = await trustByPath()
  return rows.map((row) => ({
    ...row,
    trust: trust.get(`${row.pageType}:${row.entityId}`) ?? trustOf({ staleFacts: 0, unreviewed: 0 }),
  }))
}

export async function ownerConflictRows() {
  const rows = await db.facts.openConflicts()
  return rows.map(({ queue, fact }) => ({
    id: queue.id,
    factId: fact.id,
    kind: fact.kind,
    slot: fact.slot,
    subjectType: fact.subjectType,
    subjectId: fact.subjectId,
    proposal: queue.proposal,
    enqueuedAt: queue.enqueuedAt,
  }))
}
