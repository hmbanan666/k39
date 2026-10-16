import { eq, inArray } from 'drizzle-orm'
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
    await useDatabase().delete(facts).where(inArray(facts.id, ids))
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

  it('returns cited live facts for many consumers in one read', async () => {
    const phone = await Facts.upsert(fact('phone', 'batch-a', { text: '+7 4012 61-64-12' }, 'stated'), [
      { consumerType: 'venue', consumerId: 'batch-a', path: 'short.phone' },
    ])
    const address = await Facts.upsert(fact('address', 'batch-b', { text: 'ул. Театральная, 30' }, 'gap'), [
      { consumerType: 'venue', consumerId: 'batch-b', path: 'short.address' },
    ])
    const hidden = await Facts.upsert(fact('phone', 'batch-c', { text: '+7 4012 00-00-00' }, 'stated'), [])
    const retired = await Facts.upsert(fact('phone', 'batch-d', { text: '+7 4012 11-11-11' }, 'stated'), [
      { consumerType: 'venue', consumerId: 'batch-d', path: 'short.phone' },
    ])
    ids.push(phone.fact.id, address.fact.id, hidden.fact.id, retired.fact.id)
    await Facts.retire(retired.fact.id)
    const rows = await Facts.forConsumers('venue', ['batch-a', 'batch-b', 'batch-c', 'batch-d'], ['phone', 'address', 'coordinates', 'status'])
    expect(rows.map((row) => row.consumerId).sort()).toEqual(['batch-a', 'batch-b'])
    expect(rows.find((row) => row.consumerId === 'batch-a')?.value).toMatchObject({ text: '+7 4012 61-64-12' })
    expect(rows.find((row) => row.consumerId === 'batch-b')?.confidence).toBe('gap')
  })
})

function fact(kind: string, subjectId: string, value: unknown, confidence: string) {
  return {
    kind,
    subjectType: 'venue',
    subjectId,
    slot: kind,
    value,
    valueHash: HASH,
    sourceUrl: null,
    sourceTitle: null,
    sourceKind: 'none',
    checkedAt: '2026-01-01T00:00:00.000Z',
    ttlDays: 180,
    confidence,
    actor: 'editor',
  }
}
