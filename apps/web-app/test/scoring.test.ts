import type { CatalogArticle, CatalogHub, CatalogVenue, ContentCatalog, ScorePlace } from '@k39/database'
import type { LengthOverride } from '../shared/length-override'
import type { LinkCatalog, ScoreSource } from '../shared/scoring'
import { describe, expect, it } from 'vitest'
import { catalogHoursKnown, catalogPageRefs, scoresFromCatalog, toStored } from '../server/utils/scoring/assemble'
import { personaCoverageReport } from '../server/utils/scoring/coverage'
import { scorePreview } from '../server/utils/scoring/preview'
import { LENGTH_OVERRIDE_IGNORED, LENGTH_OVERRIDE_STALE, REPEATED_PARAGRAPH } from '../shared/length-override'
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

function uniqueArticle(chars: number, noun: string) {
  const parts: string[] = []
  let index = 0
  while (parts.join('\n\n').length < chars) {
    parts.push(`${noun} ${index} описан отдельно: год ${1800 + (index % 50)}, признак ${noun}-${index}, и это не повтор соседнего абзаца.`)
    index += 1
  }
  return parts.join('\n\n').slice(0, chars)
}

function lengthOverride(patch: Partial<LengthOverride> = {}): LengthOverride {
  return {
    ceiling: 12_000,
    queries: ['форт а'],
    search: { impressions: 20, position: 6 },
    competitors: [],
    sections: ['История стен'],
    setAt: '2026-10-01T00:00:00.000Z',
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
  it('uses fact refs instead of the 180-day stamp once a page cites facts', () => {
    const stale = scorePage(source({ factsCheckedAt: null, factRefs: { count: 2, stale: 1 } }))
    const fresh = scorePage(source({ factsCheckedAt: null, factRefs: { count: 2, stale: 0 } }))
    expect(stale.checks.quality).toContain('stale facts')
    expect(stale.checks.quality).not.toContain('facts not checked')
    expect(fresh.checks.quality).not.toContain('stale facts')
    expect(fresh.checks.quality).not.toContain('facts not checked')
    expect(issueLabel('stale facts')).toBe('Устаревшие факты')
  })

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

  it('counts a structured faq when the body has no FAQ section', () => {
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
    ].join('\n')
    const faqItems = Array.from({ length: 6 }, (_, index) => ({
      question: `Вопрос ${index} о визите?`,
      answer: `Ответ номер ${index} достаточно длинный.`,
    }))
    const score = scorePage(source({ body, hours: '10-18', faq: faqItems }))
    expect(score.checks.quality).not.toContain('no FAQ')
    expect(score.signals.faqCount).toBe(6)
    expect(score.quality).toBe(100)
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

  it('accepts a route body that uses Без машины and a ruble table', () => {
    const body = [
      '## Какие форты открыты в 2026 году',
      '',
      '| Форт | Билет |',
      '| --- | --- |',
      '| № 5 | 500 ₽ |',
      '',
      '## План дня',
      '',
      'Выезд утром от Северного вокзала.',
      '',
      '## Без машины',
      '',
      'Автобус № 48 до форта № 5.',
      '',
      '## Бюджет на одного взрослого',
      '',
      'Билеты около 1500 ₽.',
      '',
      faq(6),
    ].join('\n')
    const score = scorePage(source({
      kind: 'route',
      path: '/marshruty/pyat-fortov',
      categorySlug: null,
      body,
      memberCount: 5,
      photoCount: 1,
    }))
    expect(score.checks.quality).not.toContain('no Как добраться')
    expect(score.checks.quality).not.toContain('no prices')
    expect(score.checks.quality).not.toContain('no FAQ')
  })

  it('accepts a collection that says how to arrive and what it costs', () => {
    const body = [
      '## Открыты с билетом',
      '',
      'Форт № 5 работает ежедневно.',
      '',
      '## Как добраться без машины',
      '',
      'Автобус № 48 по Советскому проспекту.',
      '',
      '## Сколько стоит',
      '',
      '| Форт | Взрослый |',
      '| --- | --- |',
      '| № 5 | 500 ₽ |',
      '| № 1 | 600 руб. |',
      '',
      faq(6),
    ].join('\n')
    const score = scorePage(source({
      kind: 'collection',
      path: '/podborki/otkrytye-forty',
      categorySlug: null,
      body,
      memberCount: 4,
      photoCount: 1,
    }))
    expect(score.checks.quality).not.toContain('no Как добраться')
    expect(score.checks.quality).not.toContain('no prices')
  })

  it('accepts Дорога, Транспорт, and a worded ruble price', () => {
    const body = [
      '## Дорога',
      '',
      'Электричка до Зеленоградска.',
      '',
      '## Транспорт и как сократить',
      '',
      'Обратно на автобусе.',
      '',
      '## Сколько стоит день',
      '',
      'Билет около 300 рублей.',
      '',
      faq(6),
    ].join('\n')
    const score = scorePage(source({
      kind: 'route',
      path: '/marshruty/vorota-i-bashni-peshkom',
      categorySlug: null,
      body,
      memberCount: 3,
      photoCount: 1,
    }))
    expect(score.checks.quality).not.toContain('no Как добраться')
    expect(score.checks.quality).not.toContain('no prices')
  })

  it('still flags a route that never says how to get there or what it costs', () => {
    const score = scorePage(source({
      kind: 'route',
      path: '/marshruty/empty',
      categorySlug: null,
      body: '## План дня\n\nТолько расписание. На рубеже города.',
      memberCount: 2,
      photoCount: 1,
    }))
    expect(score.checks.quality).toContain('no Как добраться')
    expect(score.checks.quality).toContain('no prices')
  })

  it('scores hub FAQ and body length from the article, not the short description', () => {
    const body = [
      'ы'.repeat(500),
      '',
      'Смотрите [маршрут](/marshruty/pyat-fortov).',
      '',
      '## Частые вопросы',
      '',
      '### Какой форт выбрать?',
      '',
      'Форт № 5, если нужен музей с часами.',
    ].join('\n')
    const score = scorePage(source({
      kind: 'hub',
      path: '/forty',
      summary: 'Коротко.',
      body,
      categorySlug: 'forty',
      photoCount: 1,
      memberCount: 2,
    }))
    expect(score.signals.bodyChars).toBeGreaterThan(500)
    expect(score.signals.faqCount).toBe(1)
    expect(score.checks.quality).toContain('FAQ 1, need 6')
    expect(score.checks.quality.some((check) => check.includes('need 2000'))).toBe(true)
    expect(score.checks.quality.some((check) => check.includes('above'))).toBe(false)
    expect(score.checks.quality).not.toContain('no Как добраться')
    expect(score.checks.quality).not.toContain('no prices')
  })

  it('accepts a hub inside 2000-8000 characters', () => {
    const score = scorePage(source({
      kind: 'hub',
      path: '/forty',
      categorySlug: 'forty',
      body: `${'ы'.repeat(4000)}\n\n${faq(6)}`,
      photoCount: 1,
      memberCount: 2,
    }))
    expect(score.checks.quality.filter((check) => check.startsWith('body ') || check.includes('FAQ') || check === 'no FAQ')).toEqual([])
  })

  it('uses an extended ceiling only when the passport justification is valid', () => {
    const now = new Date('2026-10-16T00:00:00.000Z')
    const body = uniqueArticle(9000, 'ров')
    const passport = {
      ...source().passport!,
      lengthOverride: lengthOverride({ ceiling: 12_000, setAt: '2026-10-01T00:00:00.000Z' }),
    }
    const extended = scorePage(source({
      categorySlug: 'eda',
      categoryTitle: 'Еда',
      body,
      photoCount: 1,
      passport,
      results: { ...emptyResults(), searchImported: true, searchImpressions: 12, organic30d: 10, organic90d: 40 },
    }), now)
    expect(extended.checks.quality.some((check) => check.includes('above'))).toBe(false)
    expect(extended.checks.quality).not.toContain(LENGTH_OVERRIDE_IGNORED)
    expect(extended.checks.results).not.toContain(LENGTH_OVERRIDE_STALE)
    expect(extended.signals.lengthOverride).toMatchObject({ applied: true, stale: false, ceiling: 12_000 })

    const over = scorePage(source({
      categorySlug: 'eda',
      body: uniqueArticle(13_000, 'ров'),
      photoCount: 1,
      passport,
    }), now)
    expect(over.checks.quality.some((check) => check.includes('above 12000'))).toBe(true)

    const ignored = scorePage(source({
      categorySlug: 'eda',
      body,
      photoCount: 1,
      passport: { ...passport, lengthOverride: lengthOverride({ ceiling: 5000 }) },
    }), now)
    expect(ignored.checks.quality).toContain(LENGTH_OVERRIDE_IGNORED)
    expect(ignored.checks.quality.some((check) => check.includes('above 6000'))).toBe(true)
  })

  it.each([
    ['place', 3000, 6000], ['route', 8000, 12000], ['collection', 5000, 8000],
    ['quest', 2000, 4000], ['hub', 2000, 8000],
  ] as const)('uses visible article text at both length boundaries for %s', (kind, min, max) => {
    const atCeiling = scorePage(source({
      kind,
      body: `${'ы'.repeat(max - 5)} [факт](/${'long-target-'.repeat(40)})`,
    }))
    expect(atCeiling.signals.bodyChars).toBe(max)
    expect(atCeiling.checks.quality.filter((check) => check.startsWith('body '))).toEqual([])

    const short = scorePage(source({ kind, body: `[я](/${'target'.repeat(min)})` }))
    expect(short.signals.bodyChars).toBe(1)
    expect(short.checks.quality).toContain(`body 1 chars, need ${min}-${max}`)
  })

  it('does not run long-page filler checks because of link targets alone', () => {
    const body = `${'ы'.repeat(5800)} Это уютная атмосфера. [факт](/${'target'.repeat(100)})`
    const score = scorePage(source({ body }))
    expect(score.signals.bodyChars).toBe(5827)
    expect(score.checks.quality.some((check) => check.includes('above') || check.startsWith('stop-list:'))).toBe(false)
  })

  it('measures the prepared public article after lead removal and directions folding', () => {
    const score = scorePage(source({
      summary: 'Лид.',
      body: 'Лид.\n\n## История\n\n[Форт](/fort-a)',
      howToGet: 'Идите **пешком**.',
    }))
    expect(score.signals.bodyChars).toBe('История Форт Как добраться Идите пешком.'.length)
  })

  it('flags filler on a long page and a stale override after 60 days', () => {
    const now = new Date('2026-10-16T00:00:00.000Z')
    const copied = 'Во дворе слышно шоссе круглый год, билет покупают у кассы у ворот, а стены сложены из красного кирпича в конце девятнадцатого века и стоят на своём месте до сих пор без новой облицовки.'
    const repeated = scorePage(source({
      categorySlug: 'eda',
      body: `${'к'.repeat(6200)}\n\n## Двор\n\n${copied}\n\n## Двор снова\n\n${copied}`,
      photoCount: 1,
      passport: { ...source().passport!, lengthOverride: lengthOverride({ ceiling: 20_000 }) },
    }))
    expect(repeated.checks.quality).toContain('repeated section: Двор снова')
    expect(repeated.checks.quality).toContain(REPEATED_PARAGRAPH)
    expect(repeated.quality).toBeLessThan(scorePage(source({
      categorySlug: 'eda',
      body: `${uniqueArticle(4000, 'ров')}\n\n${uniqueArticle(4000, 'маяк')}`,
      photoCount: 1,
      passport: { ...source().passport!, lengthOverride: lengthOverride({ ceiling: 20_000 }) },
    })).quality)

    const slogan = scorePage(source({
      categorySlug: 'eda',
      body: `${uniqueArticle(7000, 'ров')}\n\nЭто уютная атмосфера у форта.`,
      photoCount: 1,
    }))
    expect(slogan.checks.quality).toContain('stop-list: уютная атмосфера')
    const short = scorePage(source({ body: 'Это уютная атмосфера у форта.' }))
    expect(short.checks.quality.some((check) => check.startsWith('stop-list:'))).toBe(false)

    const stale = scorePage(source({
      categorySlug: 'eda',
      body: uniqueArticle(8000, 'ров'),
      photoCount: 1,
      passport: {
        ...source().passport!,
        lengthOverride: lengthOverride({ setAt: new Date(now.getTime() - 60 * 86_400_000).toISOString() }),
      },
      results: { ...emptyResults(), searchImported: true, searchImpressions: 0, organic30d: 10, organic90d: 40 },
    }), now)
    expect(stale.checks.results).toContain(LENGTH_OVERRIDE_STALE)
    expect(issueLabel(LENGTH_OVERRIDE_STALE)).toBe('Расширенный текст без показов 60 дней')
    expect(issueLabel('repeated section: Двор')).toBe('Повтор раздела: Двор')
    expect(issueLabel(REPEATED_PARAGRAPH)).toBe('Повтор абзаца')
    expect(issueLabel('stop-list: уютная атмосфера')).toBe('Стоп-лист: уютная атмосфера')
    expect(issueLabel(LENGTH_OVERRIDE_IGNORED)).toBe('Расширение длины не засчитано')
  })

  it('flags a minor place above 6000 characters and a hub above 8000', () => {
    const minor = scorePage(source({
      categorySlug: 'eda',
      categoryTitle: 'Еда',
      body: 'б'.repeat(7000),
    }))
    expect(minor.checks.quality.some((check) => check.includes('above 6000'))).toBe(true)
    const hub = scorePage(source({
      kind: 'hub',
      path: '/eda',
      categorySlug: 'eda',
      body: 'ы'.repeat(9000),
      photoCount: 1,
      memberCount: 2,
    }))
    expect(hub.checks.quality.some((check) => check.includes('above 8000'))).toBe(true)
  })

  it('does not require Как добраться when every collection stop is in one city', () => {
    const body = [
      'а'.repeat(5200),
      '',
      '## Сколько стоит',
      '',
      'Билет 300 ₽.',
      '',
      faq(6),
    ].join('\n')
    const stops = [
      { city: 'kaliningrad', access: null },
      { city: 'kaliningrad', access: 'уточнить у кассы' },
    ]
    for (const path of ['/podborki/gorodskie-vorota-kaliningrada', '/podborki/kaliningrad-v-dozhd']) {
      const score = scorePage(source({
        kind: 'collection',
        path,
        categorySlug: null,
        body,
        memberCount: 8,
        photoCount: 1,
        stops,
      }))
      expect(score.checks.quality).not.toContain('no Как добраться')
    }
  })

  it('accepts per-item address or transport lines instead of a collection how-to-get block', () => {
    const score = scorePage(source({
      kind: 'collection',
      path: '/podborki/dva-goroda',
      categorySlug: null,
      body: [
        'б'.repeat(5200),
        '',
        '## Сколько стоит',
        '',
        'Билет 400 рублей.',
        '',
        faq(6),
      ].join('\n'),
      memberCount: 2,
      photoCount: 1,
      stops: [
        { city: 'kaliningrad', access: 'ул. Фрунзе, 112' },
        { city: 'svetlogorsk', access: 'электричка до Светлогорска' },
      ],
    }))
    expect(score.checks.quality).not.toContain('no Как добраться')
  })

  it('still requires Как добраться when collection stops span cities and have no access lines', () => {
    const score = scorePage(source({
      kind: 'collection',
      path: '/podborki/zamki-oblasti',
      categorySlug: null,
      body: '## План\n\nДва города, без адресов.',
      memberCount: 2,
      photoCount: 1,
      stops: [
        { city: 'kaliningrad', access: null },
        { city: 'gvardeysk', access: 'касса у входа' },
      ],
    }))
    expect(score.checks.quality).toContain('no Как добраться')
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
      hubs: [{ slug: 'forty', title: 'Форты', description: 'Список.', body: '', noindex: false }],
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

  it('counts a link in the hub article, not only the short description', () => {
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
      hubs: [{
        slug: 'zamki',
        title: 'Замки',
        description: 'Короткое описание без ссылки.',
        body: 'Подробнее в статье [замок](/lonely).',
        noindex: false,
      }],
      related: [],
    })
    expect(stats.get('/lonely')?.orphan).toBe(false)
    expect(stats.get('/zamki')?.contentOutbound).toBeGreaterThan(0)
  })
})

const UPDATED = '2026-10-12T00:00:00.000Z'

function catalogPlace(patch: Partial<ScorePlace> = {}): ScorePlace {
  return {
    id: 'place-1',
    slug: 'fort-a',
    title: 'Форт А',
    summary: 'Коротко.',
    body: '',
    howToGet: null,
    hours: null,
    price: null,
    latitude: null,
    longitude: null,
    publicationStatus: 'published',
    noindex: false,
    seoTitle: null,
    seoDescription: null,
    factsCheckedAt: null,
    sources: [],
    faq: [],
    faqCount: 0,
    categorySlug: 'forty',
    categoryTitle: 'Форты',
    regionId: null,
    regionTitle: null,
    updatedAt: UPDATED,
    ...patch,
  }
}

function catalogArticle(patch: Partial<CatalogArticle> = {}): CatalogArticle {
  return {
    id: 'article-1',
    slug: 'five-forts',
    title: 'Пять фортов',
    summary: '',
    body: '',
    publicationStatus: 'draft',
    noindex: false,
    seoTitle: null,
    seoDescription: null,
    updatedAt: UPDATED,
    routeSlug: null,
    modules: [],
    sourcesCount: 0,
    ...patch,
  }
}

function catalogHub(patch: Partial<CatalogHub> = {}): CatalogHub {
  return {
    id: 'hub-1',
    slug: 'forty',
    title: 'Форты',
    description: 'Коротко.',
    body: '',
    noindex: false,
    seoTitle: TITLE,
    seoDescription: DESCRIPTION,
    updatedAt: UPDATED,
    ...patch,
  }
}

function catalog(patch: Partial<ContentCatalog> = {}): ContentCatalog {
  return {
    places: [],
    routes: [],
    routeStops: [],
    collections: [],
    collectionStops: [],
    quests: [],
    questStops: [],
    hubs: [],
    venues: [],
    related: [],
    photos: [],
    venuePhotos: [],
    passports: [],
    ...patch,
  }
}

describe('score run', () => {
  it('skips drafts and reviews, including the old five-forts quest', () => {
    const rows = catalog({
      places: [catalogPlace()],
      routes: [catalogArticle({ id: 'route-review', slug: 'chernovik', publicationStatus: 'review' })],
      quests: [catalogArticle({ id: 'quest-old', slug: 'five-forts', publicationStatus: 'draft' })],
      hubs: [catalogHub({
        body: `${'ы'.repeat(500)}\n\nСмотрите [маршрут](/marshruty/pyat-fortov).\n\n## Частые вопросы\n\n### Какой форт выбрать?\n\nФорт № 5.`,
      })],
    })
    const scores = scoresFromCatalog(rows, [], [], false)
    const paths = scores.map((row) => row.path)
    expect(paths).toContain('/fort-a')
    expect(paths).toContain('/forty')
    expect(paths).not.toContain('/kvesty/five-forts')
    expect(paths).not.toContain('/marshruty/chernovik')
    expect(catalogPageRefs(rows).map((row) => row.path)).toContain('/kvesty/five-forts')
    const hub = scores.find((row) => row.path === '/forty')
    expect(hub?.signals.bodyChars).toBeGreaterThan(500)
    expect(hub?.signals.faqCount).toBe(1)
    expect(hub?.checks.linking).not.toContain('no outbound')
    expect(hub?.checks.quality).not.toContain('no Как добраться')
  })
})

describe('collection member admission evidence', () => {
  function linked() {
    return catalog({
      places: [catalogPlace()],
      collections: [catalogArticle({ id: 'collection-1', publicationStatus: 'published' })],
      collectionStops: [{ parentId: 'collection-1', placeSlug: 'fort-a', placePublished: true, regionId: null, access: null }],
      practical: [{ subjectType: 'place', subjectId: 'place-1', admissionRows: 1, freshAdmission: 1, upcomingEvents: 0 }],
    })
  }

  it.each(['published', 'draft', 'review'] as const)('shares collection evidence across catalog/storage and %s previews', (publicationStatus) => {
    const rows = linked()
    rows.collections[0]!.publicationStatus = publicationStatus
    rows.collections[0]!.modules = [{ type: 'text', variant: 'lead', text: 'Дома стоят возле реки.' }]
    const now = new Date()
    const scores = scoresFromCatalog(rows, [], [], false, now, undefined, { include: [{ kind: 'collection', id: 'collection-1' }] })
    const stored = toStored(scores.find((score) => score.entityId === 'collection-1')!)
    expect(stored.checks.quality).not.toContain('no prices')
    const preview = scorePreview({ catalog: rows, pageType: 'collection', entityId: 'collection-1', source: publicationStatus === 'published' ? 'live' : 'draft', publicationStatus, now })
    expect(preview?.checks.quality).toEqual(stored.checks.quality)
    expect(preview?.quality).toBe(stored.quality)
  })

  it('does not inherit member hours/events or another subject type\'s entries', () => {
    const rows = linked()
    rows.places[0]!.schedule = { rules: { mode: 'always' }, verifiedAt: UPDATED }
    rows.practical = [
      { subjectType: 'place', subjectId: 'place-1', admissionRows: 0, freshAdmission: 0, upcomingEvents: 2 },
      { subjectType: 'route', subjectId: 'place-1', admissionRows: 1, freshAdmission: 1, upcomingEvents: 0 },
      { subjectType: 'venue', subjectId: 'place-1', admissionRows: 1, freshAdmission: 1, upcomingEvents: 0 },
    ]
    expect(scoresFromCatalog(rows, [], [], false).find((score) => score.entityId === 'collection-1')?.checks.quality).toContain('no prices')
  })

  it('leaves route and quest inheritance unchanged', () => {
    const rows = linked()
    rows.routes = [catalogArticle({ id: 'route-1', slug: 'route', publicationStatus: 'published' })]
    rows.quests = [catalogArticle({ id: 'quest-1', slug: 'quest', publicationStatus: 'published' })]
    rows.routeStops = [{ parentId: 'route-1', placeSlug: 'fort-a', placePublished: true, regionId: null, access: null }]
    rows.questStops = [{ parentId: 'quest-1', placeSlug: 'fort-a', placePublished: true, regionId: null, access: null }]
    const scores = scoresFromCatalog(rows, [], [], false)
    expect(scores.find((score) => score.entityId === 'collection-1')?.checks.quality).not.toContain('no prices')
    expect(scores.find((score) => score.entityId === 'route-1')?.checks.quality).toContain('no prices')
    expect(scores.find((score) => score.entityId === 'quest-1')?.checks.quality).toContain('no prices')
  })
})

describe('hours known from the schedule', () => {
  const verified = {
    rules: { seasons: [{ week: [{ days: [1, 2, 3, 4, 5], opens: '10:00', closes: '19:00' }] }] },
    verifiedAt: '2026-10-01',
  }

  function catalogVenue(patch: Partial<CatalogVenue> = {}): CatalogVenue {
    return {
      id: 'venue-1',
      slug: 'cafe-a',
      name: 'Кафе А',
      kind: 'cafe',
      description: '',
      schedule: null,
      latitude: null,
      longitude: null,
      publicationStatus: 'published',
      noindex: false,
      seoTitle: null,
      seoDescription: null,
      factsCheckedAt: null,
      regionSlug: null,
      regionTitle: null,
      updatedAt: UPDATED,
      ...patch,
    }
  }

  it('scores the hours of a schedule-only venue and not of an unverified one', () => {
    const [known] = scoresFromCatalog(catalog({ venues: [catalogVenue({ schedule: verified })] }), [], [], false)
    const [unverified] = scoresFromCatalog(catalog({ venues: [catalogVenue({ schedule: { ...verified, verifiedAt: null } })] }), [], [], false)
    const [missing] = scoresFromCatalog(catalog({ venues: [catalogVenue()] }), [], [], false)
    expect(known?.checks.quality).not.toContain('no hours')
    expect(unverified?.checks.quality).toContain('no hours')
    expect(missing?.checks.quality).toContain('no hours')
    expect(known!.quality).toBeGreaterThan(missing!.quality)
  })

  it('uses the same rule for a place, with free-text hours as the fallback', () => {
    const [scheduled] = scoresFromCatalog(catalog({ places: [catalogPlace({ schedule: verified })] }), [], [], false)
    const [text] = scoresFromCatalog(catalog({ places: [catalogPlace({ hours: '10-18' })] }), [], [], false)
    const [none] = scoresFromCatalog(catalog({ places: [catalogPlace()] }), [], [], false)
    expect(scheduled!.quality).toBeGreaterThan(none!.quality)
    expect(scheduled!.quality).toBe(text!.quality)
  })

  it('counts a 24/7 schedule and ignores one that still needs a check', () => {
    expect(catalogHoursKnown({ rules: { mode: 'always' }, verifiedAt: '2026-10-01' })).toBe(true)
    expect(catalogHoursKnown({ rules: { seasons: [{ week: [] }] }, verifiedAt: '2026-10-01' })).toBe(false)
    expect(catalogHoursKnown({ ...verified, rules: { ...verified.rules, needsCheck: true } })).toBe(false)
    expect(catalogHoursKnown(null)).toBe(false)
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
    const pending = buildWeeklyReport([{
      ...current[0]!,
      signals: { goal30Pending: true, goal90Pending: true },
    }], null, { current: '2026-10-12', previous: null })
    expect(pending.missingGoals).toEqual([])
    expect(report.drops[0]).toMatchObject({ path: '/fort-a', delta: -15 })
    expect(report.lengthOverrides).toEqual([])
  })

  it('lists a length override with its traffic, stale rows first', () => {
    const report = buildWeeklyReport([
      {
        ...current[1]!,
        signals: {
          bodyChars: 4000,
          searchImpressions: 10,
          searchClicks: 2,
          lengthOverride: { ceiling: 9000, setAt: '2026-09-01T00:00:00.000Z', applied: true, stale: false },
        },
      },
      {
        ...current[0]!,
        organic30d: 0,
        organic90d: 1,
        signals: {
          bodyChars: 9000,
          searchImpressions: 0,
          searchClicks: 0,
          lengthOverride: { ceiling: 12_000, setAt: '2026-01-01T00:00:00.000Z', applied: true, stale: true },
        },
      },
    ], null, { current: '2026-10-16', previous: null })
    expect(report.lengthOverrides.map((row) => row.path)).toEqual(['/fort-a', '/fort-b'])
    expect(report.lengthOverrides[0]).toMatchObject({
      ceiling: 12_000,
      bodyChars: 9000,
      organic30d: 0,
      organic90d: 1,
      impressions: 0,
      clicks: 0,
      stale: true,
      applied: true,
    })
  })

  it('filters by block threshold and sorts the worst quality first', () => {
    const rows = filterScores(current, { block: 'quality', below: 50, order: 'asc' })
    expect(rows.map((row) => row.path)).toEqual(['/fort-a'])
  })
})

describe('goal grace and status scope', () => {
  const now = new Date('2026-10-21T00:00:00.000Z')
  const quiet = { ...emptyResults(), organic30d: 0, organic90d: 0 }
  const goals = {
    targetQueries: ['форт а'],
    audience: 'семьи',
    primaryAction: 'read' as const,
    goal30d: 5,
    goal90d: 50,
    notes: null,
  }

  function daysBefore(days: number) {
    return new Date(now.getTime() - days * 86_400_000).toISOString()
  }

  function at(days: number, patch: Partial<ScoreSource> = {}) {
    return scorePage(source({
      results: quiet,
      passport: goals,
      firstPublishedAt: daysBefore(days),
      ...patch,
    }), now)
  }

  it('keeps both goals pending at day 5, judges 30 days at day 40, and both at day 100', () => {
    const day5 = at(5)
    expect(day5.checks.results).toEqual(['goal pending (25 days)', 'goal pending (85 days)'])
    expect(day5.results).toBe(71)
    expect(day5.signals.goal30Pending).toBe(true)
    expect(day5.signals.goal90Pending).toBe(true)

    const day40 = at(40)
    expect(day40.checks.results).toEqual(['organic 30d: 0, goal 5', 'goal pending (50 days)'])
    expect(day40.results).toBe(53)
    expect(day40.signals.goal30Pending).toBe(false)
    expect(day40.signals.goal90Pending).toBe(true)

    const day100 = at(100)
    expect(day100.checks.results).toEqual(['organic 30d: 0, goal 5', 'organic 90d: 0, goal 50'])
    expect(day100.results).toBe(40)
    expect(day100.signals.goal30Pending).toBe(false)
    expect(day100.signals.goal90Pending).toBe(false)

    const met = at(100, { results: { ...quiet, organic30d: 5, organic90d: 50 } })
    expect(met.checks.results).toEqual([])
    expect(met.results).toBe(100)
  })

  it('does not let an empty passport outscore a page that has goals', () => {
    const youngEmpty = at(5, { passport: null })
    const youngGoals = at(5)
    expect(youngEmpty.results).toBe(youngGoals.results)
    expect(youngEmpty.checks.results).toEqual(['goal pending (25 days)', 'goal pending (85 days)'])

    const oldEmpty = at(100, { passport: null })
    const oldUnmet = at(100)
    expect(oldEmpty.checks.results).toEqual(['no 30-day goal', 'no 90-day goal'])
    expect(oldEmpty.results).toBe(oldUnmet.results)
    expect(oldEmpty.results).toBeLessThan(at(100, { results: { ...quiet, organic30d: 5, organic90d: 50 } }).results)

    const partial = at(100, {
      passport: { ...goals, goal30d: 10 },
      results: { ...quiet, organic30d: 4, organic90d: 0 },
    })
    const missing = at(100, {
      passport: null,
      results: { ...quiet, organic30d: 4, organic90d: 0 },
    })
    expect(missing.results).toBeLessThanOrEqual(partial.results)

    const metEarly = at(5, { results: { ...quiet, organic30d: 5, organic90d: 0 } })
    expect(metEarly.checks.results).toEqual(['goal pending (85 days)'])
    expect(metEarly.results).toBe(88)
    expect(metEarly.signals.goal30Pending).toBe(false)
    expect(metEarly.signals.goal90Pending).toBe(true)
    const bothMet = at(5, { results: { ...quiet, organic30d: 5, organic90d: 50 } })
    expect(bothMet.checks.results).toEqual([])
    expect(bothMet.results).toBe(100)
    const emptySame = at(5, { passport: null, results: { ...quiet, organic30d: 5, organic90d: 50 } })
    expect(emptySame.results).toBe(71)
    expect(emptySame.results).toBeLessThan(metEarly.results)
    expect(emptySame.results).toBeLessThan(bothMet.results)
  })

  it('holds goals while the page is hidden from the index', () => {
    const hidden = at(100, { noindex: true })
    expect(hidden.checks.results).toEqual(['goal pending (not indexable)'])
    expect(hidden.results).toBe(71)
    expect(issueLabel('goal pending (25 days)')).toBe('Цель ещё не оценивается (25 дн.)')
    expect(issueLabel('goal pending (not indexable)')).toBe('Цель не оценивается: страница закрыта от индекса')
    expect(issueLabel('goal pending (unpublished)')).toBe('Цель не оценивается: страница не опубликована')
    expect(issueLabel('status warning: closure may refer to another subject')).toBe('Фраза про закрытие может относиться к другому месту')
  })

  it('does not charge a closure penalty for footwear advice in a fort FAQ', () => {
    const page = source({
      title: 'Форт №2а «Барнеков»',
      body: 'Фасад доступен для осмотра.',
      faq: [{ question: 'Что взять с собой?', answer: 'Закрытую обувь, которая не боится сырости, фонарь и заряженный телефон.' }],
    })
    const unchecked = scorePage(page)
    const open = scorePage({ ...page, scheduleMode: 'always' })
    expect(open.checks.quality).toEqual(unchecked.checks.quality)
    expect(open.quality).toBe(unchecked.quality)
    expect(open.total).toBe(unchecked.total)

    const closedFaq = { ...page, faq: [{ question: 'Можно войти?', answer: 'Закрыт.' }] }
    const contradiction = scorePage({ ...closedFaq, scheduleMode: 'always' })
    const consistent = scorePage({ ...closedFaq, scheduleMode: 'closed' })
    expect(contradiction.checks.quality).toContain('status contradiction: text says closed, schedule mode is always')
    expect(contradiction.quality).toBe(consistent.quality - 15)
  })

  it('keeps town appointment scores neutral for another attraction and charges 15 for the town itself', () => {
    const page = source({
      title: 'Полесск', body: uniqueArticle(3100, 'Город'),
      faq: [{ question: 'Как посетить пивоварню «Бланкенштайн»?', answer: 'Ул. Рабочая, 5, экскурсии по записи.' }],
    })
    const unchecked = scorePage(page)
    const town = scorePage({ ...page, scheduleMode: 'always' })
    expect(town.checks.quality).toEqual(unchecked.checks.quality)
    expect(town.quality).toBe(unchecked.quality)
    const own = scorePage({ ...page, scheduleMode: 'always', faq: [{ question: 'Как попасть в Полесск?', answer: 'Сам город доступен по записи.' }] })
    expect(own.checks.quality).toContain('status contradiction: text says by appointment, schedule is always open')
    expect(own.quality).toBe(town.quality - 15)
    const museum = scorePage({ ...page, title: 'Музей «Бланкенштайн»', scheduleMode: 'always' })
    expect(museum.checks.quality).toContain('status contradiction: text says by appointment, schedule is always open')
    expect(museum.quality).toBe(town.quality - 15)
  })

  it('uses the corrected shared superlative rule in long-page filler scoring', () => {
    const body = uniqueArticle(6200, 'Город')
    const neutral = scorePage(source({ body: `${body}\n\nВ самом Нестерове стоит дом.` }))
    const superlative = scorePage(source({ body: `${body}\n\nВ самом красивом городе стоит дом.` }))
    expect(neutral.checks.quality).not.toContain('stop-list: empty superlatives')
    expect(superlative.checks.quality).toContain('stop-list: empty superlatives')
    expect(superlative.quality).toBeLessThan(neutral.quality)
  })

  it.each([
    { title: 'Кирха', text: 'Кирха рядом с музеем доступна по записи.', own: true },
    { title: 'Музей «Бланкенштайн»', text: 'Ресторан музея принимает по записи.', own: false },
    { title: 'Музей «Бланкенштайн»', text: 'В музее кафе принимает по записи.', own: false },
    { title: 'Кафе «Башня»', text: 'В музее кафе принимает по записи.', own: true },
    { title: 'Музей «Бланкенштайн»', text: 'В музее по записи принимает кафе.', own: false },
    { title: 'Кафе «Башня»', text: 'В музее по записи принимает кафе.', own: true },
  ])('preserves the 15-point appointment subject penalty with complements: $text', ({ title, text, own }) => {
    const page = source({ title, body: text })
    const unchecked = scorePage(page)
    const always = scorePage({ ...page, scheduleMode: 'always' })
    const appointment = scorePage({ ...page, scheduleMode: 'appointment' })
    expect(always.quality).toBe(unchecked.quality - (own ? 15 : 0))
    expect(appointment.quality).toBe(unchecked.quality - (own ? 0 : 15))
    expect(always.checks.quality.some((check) => check.startsWith('status contradiction'))).toBe(own)
    expect(appointment.checks.quality.some((check) => check.startsWith('status contradiction'))).toBe(!own)
  })

  it('does not charge 15 points for a tenant closure, and still charges a real one', () => {
    const body = 'Ворота временно закрыты на реставрацию.'
    const closed = scorePage(source({ scheduleMode: 'closed', body }))
    const open = scorePage(source({ scheduleMode: 'always', body }))
    expect(open.checks.quality).toContain('status contradiction: text says closed, schedule mode is always')
    expect(open.quality).toBe(closed.quality - 15)

    const tenant = 'Фасад доступен для осмотра круглосуточно, а ресторан «Солнечный камень» внутри, по данным Яндекс Карт, временно не работает.'
    const page = scorePage(source({
      scheduleMode: 'always',
      body: tenant,
      faq: [{ question: 'Можно ли поесть внутри?', answer: 'Сейчас нет: ресторан в казематах временно не работает.' }],
    }))
    expect(page.checks.quality.some((check) => check.startsWith('status contradiction'))).toBe(false)

    const fromFaq = scorePage(source({
      scheduleMode: 'always',
      body: 'Фасад доступен для осмотра круглосуточно.',
      faq: [{ question: 'Идут ли работы?', answer: 'Ворота временно закрыты на реставрацию.' }],
    }))
    expect(fromFaq.checks.quality).toContain('status contradiction: text says closed, schedule mode is always')

    const titled = [
      { title: 'Музей «Фридландские ворота»', body: 'Музей «Фридландские ворота» временно закрыт на реставрацию.' },
      { title: 'Форт №5 «Король Фридрих Вильгельм III»', body: 'Форт №5 «Король Фридрих Вильгельм III» сейчас закрыт для посещения.' },
      { title: 'Башня', body: 'Выставка завершилась, а сама башня временно закрыта на ремонт.' },
      { title: 'Здание биржи', body: 'Здание временно закрыто на ремонт, работает только кафе на первом этаже.' },
      { title: 'Башня', body: 'Закрыт на реконструкцию до 2027 года, кафе «Башня» тоже не работает.' },
    ]
    for (const item of titled) {
      const shut = scorePage(source({ scheduleMode: 'closed', title: item.title, body: item.body }))
      const listed = scorePage(source({ scheduleMode: 'always', title: item.title, body: item.body }))
      expect(listed.quality).toBe(shut.quality - 15)
    }
    const historic = 'Форт №5 «Король Фридрих Вильгельм III» сейчас закрыт для посещения.'
    const historicShut = scorePage(source({ scheduleMode: 'closed', title: 'Форт №5', body: historic }))
    const historicOpen = scorePage(source({ scheduleMode: 'always', title: 'Форт №5', body: historic }))
    expect(historicOpen.checks.quality).toContain('status contradiction: text says closed, schedule mode is always')
    expect(historicOpen.quality).toBe(historicShut.quality - 15)

    const strayShut = scorePage(source({ body: '«Солнечный камень» временно не работает.' }))
    const strayOpen = scorePage(source({
      scheduleMode: 'always',
      title: 'Росгартенские ворота',
      body: '«Солнечный камень» временно не работает.',
    }))
    expect(strayOpen.checks.quality).toContain('status warning: closure may refer to another subject')
    expect(strayOpen.checks.quality.some((check) => check.startsWith('status contradiction'))).toBe(false)
    expect(strayOpen.quality).toBe(strayShut.quality)

    const judittenOpen = scorePage(source({
      scheduleMode: 'always',
      title: 'Кирха «Юдиттен»',
      body: 'Фасад на месте.',
      faq: [{ question: 'Идёт ремонт?', answer: 'Да, кирха «Юдиттен» сейчас закрыта на реставрацию' }],
    }))
    const judittenShut = scorePage(source({
      scheduleMode: 'closed',
      title: 'Кирха «Юдиттен»',
      body: 'Фасад на месте.',
      faq: [{ question: 'Идёт ремонт?', answer: 'Да, кирха «Юдиттен» сейчас закрыта на реставрацию' }],
    }))
    expect(judittenOpen.quality).toBe(judittenShut.quality - 15)

    const ambiguous = 'Временно закрыт ресторан внутри.'
    const warned = scorePage(source({ scheduleMode: 'always', body: ambiguous }))
    const skipped = scorePage(source({ body: ambiguous }))
    expect(warned.checks.quality).toContain('status warning: closure may refer to another subject')
    expect(warned.quality).toBe(skipped.quality)
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

describe('persona coverage report', () => {
  it('builds rows for targeted pages and flags gaps', () => {
    const month = catalogArticle({ id: 'month-1', slug: 'month', title: 'Месяц', body: 'Текст', modules: [{ type: 'plans' }, { type: 'text', role: 'events' }] })
    const report = personaCoverageReport(catalog({ collections: [month], places: [catalogPlace()] }), [
      { pageType: 'collection', entityId: 'month-1', personaCode: 'local', weight: 3, primary: true },
      { pageType: 'collection', entityId: 'month-1', personaCode: 'business', weight: 1, primary: false },
    ])
    expect(report.untargeted).toBe(1)
    expect(report.rows).toHaveLength(1)
    const cells = Object.fromEntries(report.rows[0]!.cells.map((cell) => [cell.code, cell]))
    expect(cells.local).toMatchObject({ score: 67, primary: true, gap: false })
    expect(cells.business).toMatchObject({ score: 33, weight: 1, gap: true, missing: ['nearby', 'eat-nearby'] })
    expect(cells.family!.weight).toBeNull()
  })
})
