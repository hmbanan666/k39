import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { useDatabase } from '../../database'
import { factRevisions, facts, verificationQueue } from '../../tables'
import { Facts } from '../facts'

const HASH = 'a'.repeat(64)

describe('typed facts', () => {
  const ids: string[] = []

  afterEach(async () => {
    if (!ids.length) {
      return
    }
    await useDatabase().delete(facts).where(eq(facts.id, ids[0]!))
    ids.length = 0
  })

  it('confirms the same hash without a revision and keeps one open conflict', async () => {
    const refs = [{ consumerType: 'venue', consumerId: 'venue-fact-test', path: 'short.phone' }]
    const input = {
      kind: 'phone',
      subjectType: 'venue',
      subjectId: 'venue-fact-test',
      slot: 'phone',
      value: { text: '+7 401 000' },
      valueHash: HASH,
      sourceUrl: null,
      sourceTitle: null,
      sourceKind: 'owner',
      checkedAt: '2026-01-01T00:00:00.000Z',
      ttlDays: 180,
      confidence: 'owner',
      actor: 'owner',
    }
    const first = await Facts.upsert(input, refs)
    ids.push(first.fact.id)
    expect(await Facts.latestActor(first.fact.id)).toBe('owner')
    const again = await Facts.upsert({ ...input, checkedAt: '2026-02-01T00:00:00.000Z' }, refs)
    expect(again.revised).toBe(false)
    expect(await Facts.revisions(first.fact.id)).toHaveLength(1)
    expect((await Facts.confirm(first.fact.id, 'b'.repeat(64), '2026-03-01T00:00:00.000Z')).ok).toBe(false)
    const confirmed = await Facts.confirm(first.fact.id, HASH, '2026-03-01T00:00:00.000Z')
    expect(confirmed.ok).toBe(true)
    expect(await Facts.revisions(first.fact.id)).toHaveLength(1)
    expect(confirmed.fact?.checkedAt).toContain('2026-03-01')
    const queued = await Facts.enqueue({
      target: 'fact',
      factId: first.fact.id,
      reason: 'owner_conflict',
      proposal: { value: { text: 'other' } },
    })
    const repeat = await Facts.enqueue({
      target: 'fact',
      factId: first.fact.id,
      reason: 'owner_conflict',
      proposal: { value: { text: 'third' } },
    })
    expect(repeat.id).toBe(queued.id)
    expect(repeat.proposal).toMatchObject({ value: { text: 'third' } })
    await Facts.closeForFact(first.fact.id)
    const open = await useDatabase().select().from(verificationQueue).where(eq(verificationQueue.factId, first.fact.id))
    expect(open.every((row) => row.resolvedAt)).toBe(true)
    const revisionRows = await useDatabase().select().from(factRevisions).where(eq(factRevisions.factId, first.fact.id))
    expect(revisionRows).toHaveLength(1)
  })
})
