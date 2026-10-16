import { describe, expect, it } from 'vitest'
import { Facts } from '../facts'

describe('review invalidation', () => {
  it('drops hashes that no longer match and keeps the review time', async () => {
    const saved = await Facts.saveReview({
      pageType: 'place',
      entityId: 'prune-fixture',
      reviewer: 'test',
      sections: [{ path: 'summary', hash: 'keep' }, { path: 'old', hash: 'drop' }],
    })
    const pruned = await Facts.retainReviewSections('place', 'prune-fixture', ['keep'])
    expect(pruned?.sections).toEqual([{ path: 'summary', hash: 'keep' }])
    expect(pruned?.reviewedAt).toBe(saved?.reviewedAt)
    const same = await Facts.retainReviewSections('place', 'prune-fixture', ['keep'])
    expect(same?.reviewedAt).toBe(saved?.reviewedAt)
    expect(same?.sections).toHaveLength(1)
  })
})
