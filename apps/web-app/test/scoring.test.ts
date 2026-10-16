import type { CatalogArticle, CatalogHub, ContentCatalog, ScorePlace } from '@k39/database'
import type { LengthOverride } from '../shared/length-override'
import type { LinkCatalog, ScoreSource } from '../shared/scoring'
import { describe, expect, it } from 'vitest'
import { catalogPageRefs, scoresFromCatalog } from '../server/utils/scoring/assemble'
import { personaCoverageReport } from '../server/utils/scoring/coverage'
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
