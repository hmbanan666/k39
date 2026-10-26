import { describe, expect, it } from 'vitest'
import { latestSitemapLastmod, sitemapLastmod } from '../server/utils/sitemap-fields'

describe('sitemap timestamps', () => {
  it('reads real timestamps and skips blanks', () => {
    expect(sitemapLastmod(null)).toBeUndefined()
    expect(sitemapLastmod('')).toBeUndefined()
    expect(sitemapLastmod('not-a-date')).toBeUndefined()
    expect(sitemapLastmod('2026-10-12T17:18:52.000Z')).toBe('2026-10-12T17:18:52.000Z')
    expect(sitemapLastmod('2026-10-12 17:18:52+00')).toBe('2026-10-12T17:18:52.000Z')
    expect(latestSitemapLastmod(['2026-10-11T00:00:00.000Z', null, '2026-10-13T07:58:06.000Z', 'nope'])).toBe(
      '2026-10-13T07:58:06.000Z',
    )
    expect(latestSitemapLastmod([null, ''])).toBeUndefined()
  })
})
