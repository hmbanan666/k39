import { describe, expect, it } from 'vitest'
import { guideFacts, russianDay } from '../shared/place-guide'
import { scheduleRulesSchema } from '../shared/schedule'
import { isoDay, pageFaq, placeDocument, schemaProblems, splitDirections } from '../shared/seo'

const base = {
  slug: 'fort-test',
  title: 'Форт тест',
  summary: 'Форт внешнего кольца, открыт для посещения как музей под открытым небом.',
  categorySlug: 'forty',
  categoryTitle: 'Форты',
  regionTitle: 'Калининград',
  latitude: 54.7,
  longitude: 20.5,
  hours: null,
  sources: [{ title: 'Источник', url: 'https://example.org/a' }],
}

describe('place guide template', () => {
  it.each([
    ['appointment', 'По предварительной договорённости'],
    ['always', 'Круглосуточно'],
    ['closed', 'Закрыто'],
  ] as const)('keeps the %s schedule in the server-rendered facts', (mode, text) => {
    const rules = scheduleRulesSchema.parse({ mode, note: 'Уточните условия посещения' })
    const facts = guideFacts({ schedule: { rules, verifiedAt: '2026-10-22', sourceUrl: 'https://museum.example/hours' } })
    expect(facts.find((row) => row.key === 'hours')?.value).toContain(text)
    expect(facts.find((row) => row.key === 'hours')?.value).toContain(rules.note)
  })

  it('formats the checked day in Russian', () => {
    expect(russianDay('2026-10-13')).toBe('13 октября 2026')
    expect(russianDay('2026-03-01T10:00:00.000Z')).toBe('1 марта 2026')
    expect(russianDay(null)).toBe('')
    expect(isoDay('2026-10-13 08:00:00.000+00')).toBe('2026-10-13')
    expect(isoDay('garbage')).toBeNull()
  })

  it('drops empty answer rows', () => {
    expect(guideFacts({ visitDuration: ' ', bestTime: 'май–сентябрь', hours: null, price: '300 ₽' }).map((row) => row.key)).toEqual(['season', 'price'])
    expect(guideFacts({})).toEqual([])
  })

  it('prefers the structured FAQ over the body section', () => {
    const body = '## Частые вопросы\n\n**Можно с собакой?** Да.'
    expect(pageFaq(body, [{ question: 'Есть парковка?', answer: 'Есть у входа.' }])).toEqual([{ question: 'Есть парковка?', answer: 'Есть у входа.' }])
    expect(pageFaq(body, [])).toEqual([{ question: 'Можно с собакой?', answer: 'Да.' }])
    expect(pageFaq('', [])).toEqual([])
  })

  it('emits WebPage, Organization and FAQPage only when a FAQ exists', () => {
    const plain = placeDocument({ ...base, updatedAt: '2026-10-12T09:00:00.000Z', checkedAt: '2026-10-01' })
    const types = plain.jsonLd.map((node) => node['@type'])
    expect(types).toContain('WebPage')
    expect(types).toContain('Organization')
    expect(types).not.toContain('FAQPage')
    const page = plain.jsonLd.find((node) => node['@type'] === 'WebPage')!
    expect(page).toMatchObject({
      dateModified: '2026-10-12',
      lastReviewed: '2026-10-01',
      about: { '@id': 'https://k39.online/fort-test#place' },
      publisher: { '@id': 'https://k39.online/#organization' },
    })
    expect(schemaProblems(plain.jsonLd)).toEqual([])

    const withFaq = placeDocument({ ...base, faq: [{ question: 'Сколько стоит вход?', answer: '300 ₽ по данным музея.' }] })
    expect(withFaq.jsonLd.some((node) => node['@type'] === 'FAQPage')).toBe(true)
    expect(schemaProblems(withFaq.jsonLd)).toEqual([])
  })

  it('moves the body directions section into its own block', () => {
    const split = splitDirections('Текст.\n\n## Как добраться\n\nАвтобус 1.\n\n## История\n\nДавно.')
    expect(split.directions).toBe('Автобус 1.')
    expect(split.article).toBe('Текст.\n\n## История\n\nДавно.')
    expect(splitDirections('Только текст.')).toEqual({ article: 'Только текст.', directions: '' })
  })
})
