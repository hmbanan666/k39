import { inArray } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { useDatabase } from '../../database'
import { normalizeSearchQuery, searchVariants } from '../../search-text'
import { analyticsSearchQueries, places, searchEvents } from '../../tables'
import { Search } from '../search'

const SLUGS = ['search-fort-kenig', 'search-zamok-tapiau', 'search-draft', 'search-decomposed']

describe('site search', () => {
  beforeAll(async () => {
    const db = useDatabase()
    await db.delete(places).where(inArray(places.slug, SLUGS))
    await db.insert(places).values([
      {
        slug: 'search-fort-kenig',
        title: 'Форт Кёнигсберг',
        summary: 'Кирпичный форт внешнего кольца.',
        body: 'Ров, казармы и капонир.',
        publicationStatus: 'published',
      },
      {
        slug: 'search-zamok-tapiau',
        title: 'Замок Тапиау',
        summary: 'Орденский замок в Гвардейске.',
        publicationStatus: 'published',
      },
      {
        slug: 'search-draft',
        title: 'Форт Черновик',
        summary: 'Не опубликован.',
        publicationStatus: 'draft',
      },
      {
        slug: 'search-decomposed',
        title: 'Музеи\u0306 у рва',
        summary: 'Про замо\u0301к в подписи.',
        body: 'Вои\u0306ска здесь не стоят.',
        publicationStatus: 'published',
      },
    ])
  })

  it('finds published pages by prefix, ё, typo, layout and transliteration', async () => {
    const paths = async (q: string) => (await Search.query(q)).map((row) => row.path)
    expect(await paths('замо')).toContain('/search-zamok-tapiau')
    expect(await paths('кенигсберг')).toContain('/search-fort-kenig')
    expect(await paths('кёнигсберг')).toContain('/search-fort-kenig')
    expect(await paths('кенигсбрег')).toContain('/search-fort-kenig')
    expect(await paths('rfybuc,thu')).toContain('/search-fort-kenig')
    expect(await paths('kenigsberg')).toContain('/search-fort-kenig')
    expect(await paths('капонир')).toContain('/search-fort-kenig')
    expect(await paths('музей')).toContain('/search-decomposed')
    expect(await paths('музеи\u0306')).toContain('/search-decomposed')
    expect(await paths('замо\u0301к')).toContain('/search-decomposed')
    expect(await paths('войска')).toContain('/search-decomposed')
    expect(await paths('черновик')).not.toContain('/search-draft')
    expect(await paths('')).toEqual([])
  })

  it('records searches, clicks and refinements and reports them', async () => {
    const db = useDatabase()
    await db.delete(searchEvents)
    const day = new Date().toISOString().slice(0, 10)
    await db.delete(analyticsSearchQueries).where(inArray(analyticsSearchQueries.query, ['Форт Кёнигсберг']))
    await db
      .insert(analyticsSearchQueries)
      .values({ day, engine: 'google', page: '/x', query: 'Форт Кёнигсберг', impressions: 7, clicks: 1, position: 8 })
    const now = Date.now()
    const at = (offset: number) => new Date(now - offset).toISOString()
    const base = { visitorKey: 'v1', sessionKey: 's1', surface: 'header' }
    await Search.insertEvents([
      {
        ...base,
        searchId: 'a',
        eventType: 'search',
        query: 'фрт',
        normalized: 'фрт',
        resultCount: 0,
        occurredAt: at(60_000),
      },
      {
        ...base,
        searchId: 'b',
        eventType: 'search',
        query: 'Форт Кёнигсберг',
        normalized: normalizeSearchQuery('Форт Кёнигсберг'),
        resultCount: 3,
        occurredAt: at(30_000),
      },
      {
        ...base,
        searchId: 'b',
        eventType: 'click',
        position: 1,
        resultPath: '/search-fort-kenig',
        occurredAt: at(20_000),
      },
      {
        ...base,
        searchId: 'b',
        eventType: 'search',
        query: 'dup',
        normalized: 'dup',
        resultCount: 3,
        occurredAt: at(10_000),
      },
      { visitorKey: 'bot', searchId: 'c', eventType: 'search', isBot: true, normalized: 'фрт', resultCount: 0 },
    ])
    const from = new Date(now - 3_600_000)
    const to = new Date(now + 60_000)
    const report = await Search.report(from, to)
    expect(report.totals.searches).toBe(2)
    expect(report.totals.zeroResults).toBe(1)
    expect(report.totals.clickRate).toBe(50)
    expect(report.totals.refinementRate).toBe(50)
    expect(report.totals.exitRate).toBe(0)
    expect(report.zeroResults).toEqual([expect.objectContaining({ query: 'фрт', searches: 1, refined: 1 })])
    expect(report.positions).toEqual([{ position: 1, clicks: 1, ctr: 100 }])
    const top = report.topQueries.find((row) => row.query === 'форт кенигсберг')
    expect(top).toMatchObject({ searches: 1, clicked: 1, externalImpressions: 7 })
    expect(report.surfaces).toEqual([{ surface: 'header', searches: 2, clicked: 1 }])
  })

  it('builds layout and transliteration variants only for Latin input', () => {
    expect(searchVariants('Форт  №5!')).toEqual(['форт 5'])
    expect(searchVariants('ащкен')).toEqual(['ащкен'])
    expect(searchVariants('ajhn')).toEqual(['ajhn', 'форт', 'айхн'])
    expect(normalizeSearchQuery('музеи\u0306')).toBe('музей')
    expect(normalizeSearchQuery('вои\u0306ска')).toBe('войска')
    expect(normalizeSearchQuery('замо\u0301к')).toBe('замок')
    expect(normalizeSearchQuery('Музей ёлка')).toBe('музей елка')
    expect(searchVariants('музеи\u0306')).toEqual(['музей'])
    expect(normalizeSearchQuery('музеи\u0306')).toBe(normalizeSearchQuery('музей'))
  })
})
