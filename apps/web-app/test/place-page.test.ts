import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../shared/markdown'
import { placeDocument } from '../shared/seo'

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
  })
})
