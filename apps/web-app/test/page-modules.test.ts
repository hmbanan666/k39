import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { monthName } from '../shared/month-guide'
import { categoryTags, COLLECTION_BODY_REJECTED, collectionArticle, collectionWritePlan, fitsPicker, HUB_RENDERED_FIELDS, modulesArticle, pageModulesSchema, parsePickerQuery, pickerFit, pickerQuery, rankByPicker, toPublicModules } from '../shared/page-modules'
import { collectionDocument, tuneRobots } from '../shared/seo'
import { writingHits } from '../shared/writing'

describe('picker query', () => {
  it('keeps known values and one answer for single-choice questions', () => {
    const state = parsePickerQuery({ i: 'more,istoriya,nope,more', c: 'deti,sobaka', t: ['mashina'], x: '1' })
    expect(state).toEqual({ interest: ['more', 'istoriya'], company: ['deti'], transport: ['mashina'] })
    expect(pickerQuery(state)).toEqual({ i: 'more,istoriya', c: 'deti', t: 'mashina' })
  })

  it('reads only the questions the page asks', () => {
    expect(parsePickerQuery({ i: 'more', t: 'mashina' }, ['interest'])).toEqual({ interest: ['more'] })
  })

  it('makes a parametric state noindex, the clean page stays indexable', () => {
    const doc = collectionDocument({ path: '/podborki/x', h1: 'X', summary: 'X', crumbName: 'подборка', parent: { name: 'Подборки', href: '/podborki' }, items: [], kind: 'CollectionPage' })
    expect(tuneRobots(doc, {}).robots).not.toContain('noindex')
    expect(tuneRobots(doc, { i: 'more' }).robots).toContain('noindex')
    expect(doc.canonical).toBe('https://k39.online/podborki/x')
  })

  it('is a clean param for Yandex', () => {
    expect(readFileSync(resolve(__dirname, '../public/robots.txt'), 'utf8')).toContain('Clean-param: i&c&t /podborki/')
  })
})

describe('picker ranking', () => {
  const cards = [
    { id: 'car-castles', tags: ['istoriya', 'mashina'] },
    { id: 'untagged', tags: [] as string[] },
    { id: 'city-rain', tags: ['muzei', 'istoriya', 'bez-mashiny', 'peshkom'] },
    { id: 'spit', tags: ['priroda', 'mashina'] },
  ]

  it('treats an untagged question as neutral', () => {
    expect(pickerFit(['istoriya'], { transport: ['bez-mashiny'] })).toEqual({ matched: 0, missed: 0 })
    expect(fitsPicker(pickerFit(['istoriya'], { interest: ['istoriya'], transport: ['bez-mashiny'] }))).toBe(true)
    expect(fitsPicker(pickerFit(['istoriya', 'mashina'], { interest: ['istoriya'], transport: ['bez-mashiny'] }))).toBe(false)
  })

  it('moves fitting cards up and keeps every card', () => {
    const ranked = rankByPicker(cards, (card) => card.tags, { interest: ['istoriya'], transport: ['bez-mashiny'] })
    expect(ranked.map((entry) => entry.item.id)).toEqual(['city-rain', 'untagged', 'car-castles', 'spit'])
  })

  it('keeps the stored order without answers', () => {
    expect(rankByPicker(cards, (card) => card.tags, {}).map((entry) => entry.item.id)).toEqual(cards.map((card) => card.id))
  })

  it('tags place cards from their category', () => {
    expect(categoryTags('forty')).toEqual(['istoriya'])
    expect(categoryTags('unknown')).toEqual([])
  })
})

describe('page modules', () => {
  const modules = [
    { type: 'months' },
    { type: 'text', variant: 'lead', text: 'Лид' },
    { type: 'month-stats', title: 'Октябрь в цифрах', tiles: [{ label: 'Днём', value: '+12 °C' }, { label: 'Море', value: '+13 °C' }] },
    { type: 'picker', questions: ['interest', 'transport'] },
    { type: 'ideas', title: 'Идеи', items: [{ title: 'Коса', text: 'Текст [ссылка](/vysota-efa)', tags: ['priroda'] }] },
    { type: 'places', title: 'Места' },
  ]

  it('validates and renders markdown', () => {
    const rendered = toPublicModules(modules, (markdown) => `<p>${markdown}</p>`)
    expect(rendered?.map((module) => module.type)).toEqual(['months', 'text', 'month-stats', 'picker', 'ideas', 'places'])
    const ideas = rendered?.[4]
    expect(ideas?.type === 'ideas' && ideas.items[0]?.html).toBe('<p>Текст [ссылка](/vysota-efa)</p>')
  })

  it('rejects unknown tags, types and a second picker', () => {
    expect(pageModulesSchema.safeParse([{ type: 'ideas', title: 'x', items: [{ title: 'x', text: 'x', tags: ['beach'] }] }]).success).toBe(false)
    expect(pageModulesSchema.safeParse([{ type: 'map' }]).success).toBe(false)
    expect(pageModulesSchema.safeParse([{ type: 'picker', questions: ['interest'] }, { type: 'picker', questions: ['company'] }]).success).toBe(false)
  })

  it('falls back to the article when stored modules no longer validate', () => {
    expect(toPublicModules([{ type: 'gone' }], (value) => value)).toBeNull()
  })

  it('names months for chips', () => {
    expect(monthName(10)).toBe('Октябрь')
    expect(monthName(null)).toBe('')
  })
})

describe('collection article', () => {
  const modules = [
    { type: 'text' as const, variant: 'lead' as const, text: 'Лид про октябрь.' },
    { type: 'text' as const, variant: 'plain' as const, title: 'Частые вопросы', text: '**Можно ли?**\n\nДа.' },
    {
      type: 'month-stats' as const,
      title: 'Октябрь',
      verdict: 'Море холодное.',
      tiles: [{ label: 'Днём', value: '+12 °C', note: 'среднее' }, { label: 'Море', value: '+13 °C' }],
      rows: [{ label: 'Дождь', value: '18 дней' }],
    },
    { type: 'picker' as const, questions: ['interest' as const] },
    { type: 'ideas' as const, title: 'Идеи', items: [{ title: 'Коса', text: 'Текст про косу.', tags: ['priroda' as const] }] },
    { type: 'places' as const, title: 'Места' },
    { type: 'months' as const, title: 'Другие месяцы' },
  ]

  it('projects module prose and skips the picker', () => {
    const article = modulesArticle(modules)
    expect(article).toContain('Лид про октябрь.')
    expect(article).toContain('## Частые вопросы')
    expect(article).toContain('**Можно ли?**')
    expect(article).toContain('Море холодное.')
    expect(article).toContain('Днём +12 °C среднее')
    expect(article).toContain('Дождь: 18 дней')
    expect(article).toContain('### Коса')
    expect(article).toContain('Текст про косу.')
    expect(article).toContain('## Места')
    expect(article).toContain('## Другие месяцы')
    expect(article).not.toContain('interest')
    expect(article).not.toContain('priroda')
  })

  it('uses modules as the article and rejects a different body', () => {
    const current = 'Старый гид'
    const kept = collectionWritePlan({ sentBody: undefined, currentBody: current, modules })
    expect(kept.article).toBe('modules')
    expect(kept.renderedFields).not.toContain('body')
    expect(kept.renderedFields).toContain('modules')
    expect(kept.rejectBody).toBe(false)
    expect(kept.body).toContain('Лид про октябрь.')
    expect(kept.copy).toBe(kept.body)

    const roundTrip = collectionWritePlan({ sentBody: current, currentBody: current, modules })
    expect(roundTrip.rejectBody).toBe(false)
    expect(roundTrip.body).toContain('Лид про октябрь.')

    const edit = collectionWritePlan({ sentBody: 'Новый текст, которого не видно', currentBody: current, modules })
    expect(edit.rejectBody).toBe(true)
    expect(COLLECTION_BODY_REJECTED).toContain('modules')

    const same = collectionWritePlan({ sentBody: kept.body, currentBody: current, modules })
    expect(same.rejectBody).toBe(false)

    const stale = collectionWritePlan({ sentBody: current, currentBody: kept.body, modules })
    expect(stale.rejectBody).toBe(true)
  })

  it('keeps body when the page is an article', () => {
    const plan = collectionWritePlan({ sentBody: 'Статья', currentBody: 'Старая', modules: [] })
    expect(plan).toMatchObject({ article: 'body', rejectBody: false, body: 'Статья', copy: 'Статья' })
    expect(plan.renderedFields).toContain('body')
    const omitted = collectionWritePlan({ sentBody: undefined, currentBody: 'Старая', modules: [] })
    expect(omitted.body).toBeUndefined()
    expect(omitted.copy).toBe('Старая')
    expect(collectionArticle({ body: 'Статья', modules: [{ type: 'gone' }] })).toBe('Статья')
  })

  it('stop-list reads module prose, not a stale body', () => {
    const plan = collectionWritePlan({
      sentBody: undefined,
      currentBody: 'уютная атмосфера в архиве',
      modules: [{ type: 'text', variant: 'plain', text: 'Самый тихий берег.' }],
    })
    expect(writingHits(plan.copy).map((hit) => hit.phrase)).toContain('empty superlatives')
    expect(writingHits(plan.copy).map((hit) => hit.phrase)).not.toContain('уютная атмосфера')
    expect(writingHits('уютная атмосфера в архиве').map((hit) => hit.phrase)).toContain('уютная атмосфера')
  })

  it('save paths report the fields that render', () => {
    expect(HUB_RENDERED_FIELDS).toContain('body')
    const root = resolve(import.meta.dirname, '..')
    for (const file of [
      'server/mcp/tools/collection-save.ts',
      'server/utils/mcp/collections.ts',
      'server/utils/mcp/publish.ts',
      'server/api/admin/collections/[id].patch.ts',
      'server/utils/public-pages.ts',
      'server/utils/scoring/assemble.ts',
    ]) {
      const source = readFileSync(resolve(root, file), 'utf8')
      expect(source, file).toMatch(/collectionWritePlan|collectionArticle/)
    }
    for (const file of [
      'server/mcp/tools/collection-get.ts',
      'server/mcp/tools/hub-update.ts',
      'server/mcp/tools/hubs-list.ts',
      'server/api/admin/categories/[id].patch.ts',
    ]) {
      expect(readFileSync(resolve(root, file), 'utf8'), file).toContain('renderedFields')
    }
    expect(readFileSync(resolve(root, 'app/pages/admin/collections.vue'), 'utf8')).toContain('Страница собрана из модулей')
  })
})
