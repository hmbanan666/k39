import { describe, expect, it } from 'vitest'
import { externalLinkAttrs, formatDistance } from '../shared/links'
import { renderMarkdown } from '../shared/markdown'
import { describedAlt } from '../shared/media'
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

  it('opens off-site links in a new tab and leaves internal links alone', () => {
    const html = renderMarkdown('[Карты](https://yandex.ru/maps/?rtext=~54) и [форт](/fort-11) и [вики](https://ru.wikipedia.org/wiki/A)')
    expect(html).toContain('href="https://yandex.ru/maps/?rtext=~54" target="_blank" rel="noopener noreferrer nofollow"')
    expect(html).toContain('<a href="/fort-11">форт</a>')
    expect(html).toContain('href="https://ru.wikipedia.org/wiki/A" target="_blank" rel="noopener nofollow"')
    expect(externalLinkAttrs('https://k39.online/fort-11')).toEqual({})
    expect(externalLinkAttrs('/forty')).toEqual({})
  })

  it('puts author and license on the image object', () => {
    expect(describedAlt('Собор', 'Julian Nyča', 'cc-by-sa')).toBe('Собор. Julian Nyča. CC BY-SA 4.0')
    const doc = placeDocument({
      slug: 'kafedralnyi-sobor',
      title: 'Кафедральный собор',
      summary: 'Остров Канта.',
      categorySlug: 'forty',
      categoryTitle: 'Форты',
      regionTitle: 'Калининград',
      latitude: 54.706,
      longitude: 20.512,
      hours: null,
      sources: [{ title: 'Википедия', url: 'https://ru.wikipedia.org/wiki/sobor' }],
      images: [{
        url: 'https://k39.online/media/photo/og.jpg',
        width: 1200,
        height: 800,
        alt: 'Собор. Julian Nyča. CC BY-SA 4.0',
        author: 'Julian Nyča',
        license: 'cc-by-sa',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sobor.jpg',
      }],
    })
    const node = doc.jsonLd.find((item) => item['@type'] === 'LandmarksOrHistoricalBuildings') as { image?: Array<Record<string, unknown>> }
    const image = node.image?.[0]
    expect(image?.['@type']).toBe('ImageObject')
    expect(image?.creator).toEqual({ '@type': 'Person', 'name': 'Julian Nyča' })
    expect(image?.license).toBe('https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
    expect(image?.acquireLicensePage).toBe('https://commons.wikimedia.org/wiki/File:Sobor.jpg')
  })

  it('formats nearby distance in metres and kilometres', () => {
    expect(formatDistance(0.476)).toBe('около 500 м')
    expect(formatDistance(2.84)).toBe('2,8 км')
    expect(formatDistance(12.2)).toBe('12 км')
  })
})
