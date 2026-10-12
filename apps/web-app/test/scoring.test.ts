import type { LinkCatalog, ScoreSource } from '../shared/scoring'
import { describe, expect, it } from 'vitest'
import { buildWeeklyReport, emptyResults, filterScores, issueLabel, linkStats, queriesForPath, scorePage } from '../shared/scoring'

const TITLE = `Форт на окраине города K39 ${'а'.repeat(10)}`
const DESCRIPTION = 'б'.repeat(120)

function source(patch: Partial<ScoreSource> = {}): ScoreSource {
  return {
    kind: 'place',
    id: 'place-1',
    path: '/fort-a',
    title: 'Форт А',
    summary: 'Коротко.',
    body: '',
    howToGet: null,
    hours: null,
    price: null,
    categorySlug: 'forty',
    categoryTitle: 'Форты',
    regionTitle: null,
    latitude: null,
    longitude: null,
    sources: [],
    publicationStatus: 'published',
    noindex: false,
    seoTitle: TITLE,
    seoDescription: DESCRIPTION,
    factsCheckedAt: new Date().toISOString(),
    photoCount: 3,
    inRoute: true,
    inCollection: false,
    memberCount: 0,
    inbound: 4,
    contentOutbound: 4,
    orphan: false,
    passport: {
      targetQueries: ['форт а'],
      audience: 'семьи',
      primaryAction: 'read',
      goal30d: 10,
      goal90d: 40,
      notes: null,
    },
    results: {
      ...emptyResults(),
      organic30d: 10,
      organic90d: 40,
    },
    ...patch,
  }
}

function faq(count: number) {
  const lines = ['## Частые вопросы']
  for (let index = 0; index < count; index += 1) {
    lines.push(`**Вопрос ${index}?** Ответ номер ${index} достаточно длинный.`)
  }
  return lines.join('\n')
}

describe('page score', () => {
  it('names a thin major place: no FAQ, short description, orphan', () => {
    const score = scorePage(source({
      body: 'Мало текста.',
      seoDescription: 'в'.repeat(40),
      photoCount: 0,
      inRoute: false,
      inCollection: false,
      inbound: 0,
      contentOutbound: 0,
      orphan: true,
      factsCheckedAt: null,
      passport: null,
      publicationStatus: 'published',
    }))
    expect(score.checks.quality).toContain('no FAQ')
    expect(score.checks.quality.some((check) => check.startsWith('body ') && check.includes('need 3000-6000'))).toBe(true)
    expect(score.checks.quality).toContain('0 photos')
    expect(score.checks.quality).toContain('facts not checked')
    expect(score.checks.quality).toContain('passport empty')
    expect(score.checks.linking).toContain('orphan')
    expect(score.checks.linking).toContain('not in a route or collection')
    expect(score.checks.indexing).toContain('description 40 chars')
    expect(score.total).toBeLessThan(60)
    expect(issueLabel('no FAQ')).toBe('Нет частых вопросов')
    expect(issueLabel('orphan')).toBe('Нет входящих ссылок')
    expect(issueLabel('description 40 chars')).toBe('Описание 40 знаков')
  })

  it('gives a filled article a high quality score', () => {
    const body = [
      'а'.repeat(4000),
      '',
      '## Как добраться',
      '',
      'Автобусом.',
      '',
      '## Цены',
      '',
      'Билет 200 рублей.',
      '',
      faq(6),
    ].join('\n')
    const score = scorePage(source({ body, hours: '10-18', price: '200' }))
    expect(score.checks.quality).toEqual([])
    expect(score.quality).toBe(100)
    expect(score.checks.results).toEqual([])
  })

  it('uses the 2000 character floor for a minor place', () => {
    const score = scorePage(source({
      categorySlug: 'eda',
      categoryTitle: 'Еда',
      body: 'б'.repeat(500),
      photoCount: 1,
    }))
    expect(score.checks.quality.some((check) => check.includes('need 2000'))).toBe(true)
    expect(score.signals.tier).toBe('minor')
  })

  it('flags a route above the length band and a short FAQ', () => {
    const score = scorePage(source({
      kind: 'route',
      path: '/marshruty/long',
      categorySlug: null,
      body: `${'в'.repeat(13000)}\n\n## Как добраться\n\nПешком.\n\n## Цены\n\nБесплатно.\n\n${faq(2)}`,
      memberCount: 3,
      photoCount: 1,
    }))
    expect(score.checks.quality.some((check) => check.includes('above 12000'))).toBe(true)
    expect(score.checks.quality).toContain('FAQ 2, need 6')
  })

  it('does not punish a page when search queries were never imported', () => {
    const score = scorePage(source({
      results: { ...emptyResults(), searchImported: false, organic30d: 10, organic90d: 40 },
    }))
    expect(score.checks.results).not.toContain('no search queries')
  })

  it('reports a missed organic goal and a weak scroll', () => {
    const score = scorePage(source({
      results: {
        ...emptyResults(),
        searchImported: true,
        organic30d: 0,
        organic90d: 1,
        pageviews30d: 4,
        scrollTracked: true,
        scrollMax: 25,
        engagedTracked: true,
        avgEngagedSec: 4,
        nextClicks: 0,
      },
    }))
    expect(score.checks.results).toContain('organic 30d: 0, goal 10')
    expect(score.checks.results).toContain('no search queries')
    expect(score.checks.results).toContain('scroll 25')
    expect(score.checks.results).toContain('engaged 4s')
    expect(score.checks.results).toContain('no clicks to the next page')
  })

  it('leaves Yandex and Google unknown until a later hook sets them', () => {
    const quiet = scorePage(source())
    expect(quiet.signals.yandexIndexed).toBeNull()
    expect(quiet.checks.indexing).not.toContain('not in Yandex')
    const missed = scorePage(source({ indexingHooks: { yandex: false, google: null } }))
    expect(missed.checks.indexing).toContain('not in Yandex')
  })
})

describe('internal links', () => {
  it('counts a markdown link as inbound and does not orphan that place', () => {
    const catalog: LinkCatalog = {
      places: [
        {
          slug: 'lonely',
          title: 'Одинокий',
          categorySlug: null,
          regionId: null,
          latitude: null,
          longitude: null,
          published: true,
          noindex: false,
          body: '',
        },
        {
          slug: 'fort-a',
          title: 'Форт А',
          categorySlug: 'forty',
          regionId: 'region-1',
          latitude: 54.7,
          longitude: 20.5,
          published: true,
          noindex: false,
          body: 'Смотрите [форт](/lonely) в тексте.',
        },
      ],
      routes: [],
      collections: [],
      quests: [],
      hubs: [{ slug: 'forty', title: 'Форты', description: 'Список.', noindex: false }],
      related: [],
    }
    const stats = linkStats(catalog)
    expect(stats.get('/fort-a')?.orphan).toBe(false)
    expect(stats.get('/fort-a')?.contentOutbound).toBeGreaterThan(0)
    expect(stats.get('/lonely')?.orphan).toBe(false)
    expect(stats.get('/forty')?.orphan).toBe(false)
  })

  it('orphans a place that nobody links', () => {
    const stats = linkStats({
      places: [{
        slug: 'lonely',
        title: 'Одинокий',
        categorySlug: null,
        regionId: null,
        latitude: null,
        longitude: null,
        published: true,
        noindex: false,
        body: '',
      }],
      routes: [],
      collections: [],
      quests: [],
      hubs: [],
      related: [],
    })
    expect(stats.get('/lonely')).toMatchObject({ orphan: true, inbound: 0 })
  })
})

describe('weekly report', () => {
  const current = [{
    path: '/fort-a',
    title: 'Форт А',
    pageType: 'place' as const,
    total: 40,
    quality: 30,
    linking: 50,
    indexing: 40,
    results: 40,
    organic30d: 1,
    organic90d: 2,
    goal30d: 10,
    goal90d: 20,
  }, {
    path: '/fort-b',
    title: 'Форт Б',
    pageType: 'place' as const,
    total: 80,
    quality: 80,
    linking: 80,
    indexing: 80,
    results: 80,
    organic30d: 30,
    organic90d: 90,
    goal30d: 10,
    goal90d: 20,
  }]

  it('returns the delta, the bottom page, and the missed goal', () => {
    const report = buildWeeklyReport(current, [{ ...current[0]!, total: 55, quality: 30, linking: 50, indexing: 40, results: 40 }, { ...current[1]!, total: 70, quality: 70, linking: 70, indexing: 70, results: 70 }], {
      current: '2026-10-12',
      previous: '2026-10-05',
    })
    expect(report.previousDay).toBe('2026-10-05')
    expect(report.delta).not.toBeNull()
    expect(report.bottom[0]?.path).toBe('/fort-a')
    expect(report.top[0]?.path).toBe('/fort-b')
    expect(report.missingGoals.map((row) => row.path)).toEqual(['/fort-a'])
    expect(report.drops[0]).toMatchObject({ path: '/fort-a', delta: -15 })
  })

  it('filters by block threshold and sorts the worst quality first', () => {
    const rows = filterScores(current, { block: 'quality', below: 50, order: 'asc' })
    expect(rows.map((row) => row.path)).toEqual(['/fort-a'])
  })
})

describe('search queries', () => {
  it('matches a page URL and a site-wide target query', () => {
    const rows = [
      { page: 'https://k39.online/fort-a', query: 'форт а' },
      { page: '', query: 'билеты в форт' },
      { page: '', query: 'погода' },
    ]
    expect(queriesForPath('/fort-a', rows, ['Билеты в форт'])).toEqual(['форт а', 'билеты в форт'])
  })
})
