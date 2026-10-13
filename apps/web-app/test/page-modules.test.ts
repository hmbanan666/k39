import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { monthName } from '../shared/month-guide'
import { categoryTags, fitsPicker, pageModulesSchema, parsePickerQuery, pickerFit, pickerQuery, rankByPicker, toPublicModules } from '../shared/page-modules'
import { collectionDocument, tuneRobots } from '../shared/seo'

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
