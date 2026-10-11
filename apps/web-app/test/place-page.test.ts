import { describe, expect, it } from 'vitest'
import { formatDistance } from '../shared/links'
import { renderMarkdown } from '../shared/markdown'
import { faqFromBody, placeDocument, stripRepeatedLead } from '../shared/seo'

describe('place page', () => {
  it('renders one h1 and keeps the source link in the body contract', () => {
    const doc = placeDocument({
      slug: 'fort-11-denhoff',
      title: 'Форт № 11 «Дёнхофф»',
      summary: 'Частный музей на юго-востоке Калининграда.',
      categorySlug: 'forty',
      categoryTitle: 'Форты',
      regionTitle: 'Калининград',
      latitude: 54.656847,
      longitude: 20.567554,
      hours: '10:00-18:00',
      sources: [{ title: 'Википедия', url: 'https://ru.wikipedia.org/wiki/fort-11' }],
    })
    const html = `<h1>${doc.h1}</h1>${renderMarkdown('## Как добраться\n\nЮго-восток города.')}<a href="https://ru.wikipedia.org/wiki/fort-11">Википедия</a>`
    expect(html.match(/<h1\b/g)?.length).toBe(1)
    expect(html).toContain('Форт № 11 «Дёнхофф»')
    expect(html).toContain('Википедия')
    expect(doc.canonical).toBe('https://k39.online/fort-11-denhoff')
    expect(doc.jsonLd.some((node) => node['@type'] === 'BreadcrumbList')).toBe(true)
    expect(doc.jsonLd.some((node) => node['@type'] === 'FAQPage')).toBe(false)
  })

  it('renders a markdown table and keeps the FAQ visible as text', () => {
    const html = renderMarkdown([
      '| Когда | Цена |',
      '| --- | --- |',
      '| Вт–вс | 500 ₽ |',
      '',
      '## Частые вопросы',
      '',
      '**Можно ли войти?** Пока нет.',
    ].join('\n'))
    expect(html).toContain('<table>')
    expect(html).toContain('<th>Когда</th>')
    expect(html).toContain('<td>500 ₽</td>')
    expect(html).not.toContain('| Когда |')
    expect(html).toContain('<strong>Можно ли войти?</strong>')
  })

  it('adds FAQPage only for a Частые вопросы section and drops a repeated lead', () => {
    const body = [
      'Короткий лид.',
      '',
      'Дальше текст.',
      '',
      '## Частые вопросы',
      '',
      '**Можно ли войти?** Пока нет.',
      '',
      '## Источники',
      '',
      '**Это не вопрос** и не попадает в FAQ.',
    ].join('\n')
    const doc = placeDocument({
      slug: 'bastion-grolman',
      title: 'Бастион Грольман',
      summary: 'Короткий лид.',
      categorySlug: 'forty',
      categoryTitle: 'Форты',
      regionTitle: 'Калининград',
      latitude: 54.71,
      longitude: 20.51,
      hours: null,
      sources: [],
      body,
    })
    const faq = doc.jsonLd.find((node) => node['@type'] === 'FAQPage') as { mainEntity?: Array<{ name: string }> }
    expect(faq?.mainEntity?.map((item) => item.name)).toEqual(['Можно ли войти?'])
    expect(faqFromBody('Просто текст')).toEqual([])
    expect(stripRepeatedLead('Короткий лид.', body)).toBe('Дальше текст.\n\n## Частые вопросы\n\n**Можно ли войти?** Пока нет.\n\n## Источники\n\n**Это не вопрос** и не попадает в FAQ.')
    expect(stripRepeatedLead('Другой лид.', body)).toBe(body)
  })

  it('formats nearby distance in metres and kilometres', () => {
    expect(formatDistance(0.476)).toBe('около 500 м')
    expect(formatDistance(2.84)).toBe('2,8 км')
    expect(formatDistance(12.2)).toBe('12 км')
  })
})
