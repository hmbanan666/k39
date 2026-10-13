import { describe, expect, it } from 'vitest'
import { articleBody, shortAddress } from '../shared/address'
import { externalLinkAttrs, formatDistance } from '../shared/links'
import { renderMarkdown } from '../shared/markdown'
import { describedAlt } from '../shared/media'
import { faqFromBody, jsonLdTypes, placeDocument, stripRepeatedLead } from '../shared/seo'

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
    expect(faqFromBody([
      '## Частые вопросы',
      '',
      '**Можно ли зайти?**',
      'Нет. Закрыто на стройку.',
      '',
      '**Где сбор?**',
      '',
      'Ул. Победы, 51а.',
    ].join('\n'))).toEqual([
      { question: 'Можно ли зайти?', answer: 'Нет. Закрыто на стройку.' },
      { question: 'Где сбор?', answer: 'Ул. Победы, 51а.' },
    ])
    expect(faqFromBody([
      '### Это не вопрос раздела?',
      '',
      'Снаружи.',
      '',
      '## Частые вопросы',
      '',
      '### Какой форт выбрать, если время только на один?',
      '',
      'Форт № 5, если нужен музей с часами.',
      '',
      '### Можно ли зайти в заброшенные форты?',
      '',
      'У форта № 2а вход свободный, но без охраны.',
      '',
      '## Места',
      '',
      '**Это не вопрос?** И не попадает.',
    ].join('\n'))).toEqual([
      { question: 'Какой форт выбрать, если время только на один?', answer: 'Форт № 5, если нужен музей с часами.' },
      { question: 'Можно ли зайти в заброшенные форты?', answer: 'У форта № 2а вход свободный, но без охраны.' },
    ])
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
    const node = doc.jsonLd.find((item) => jsonLdTypes(item).includes('LandmarksOrHistoricalBuildings')) as { image?: Array<Record<string, unknown>>, citation?: unknown }
    const image = node.image?.[0]
    expect(image?.['@type']).toBe('ImageObject')
    expect(image?.creator).toEqual({ '@type': 'Person', 'name': 'Julian Nyča' })
    expect(image?.license).toBe('https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
    expect(image?.acquireLicensePage).toBe('https://commons.wikimedia.org/wiki/File:Sobor.jpg')
    expect(image?.creditText).toBe('Julian Nyča, CC BY-SA 4.0')
    expect(image?.copyrightNotice).toBe('© Julian Nyča')
    expect(node.citation).toEqual([{
      '@type': 'CreativeWork',
      'name': 'Википедия',
      'url': 'https://ru.wikipedia.org/wiki/sobor',
    }])
  })

  it('keeps a short address in the facts and leaves directions in the body', () => {
    expect(shortAddress('Неман, ул. Победы, 47 (120 км от Калининграда). Сбор на экскурсию: ул. Победы, 51а.')).toBe('Неман, ул. Победы, 47 (120 км от Калининграда).')
    expect(shortAddress('Ул. Канта, 1, остров Канта. Остановки «Рыбная деревня».')).toBe('Ул. Канта, 1, остров Канта.')
    expect(shortAddress('Литовский вал, 21')).toBe('Литовский вал, 21')
    const body = '## История\n\nТекст.\n\n## Как добраться\n\nНа машине 120 км.'
    const article = articleBody('Лид.', body, 'Неман, ул. Победы, 47. Сбор у кластера.')
    expect(article.match(/## Как добраться/g)?.length).toBe(1)
    expect(article).not.toContain('Сбор у кластера')
    expect(articleBody('Лид.', '## История\n\nТекст.', 'Неман, ул. Победы, 47.')).toContain('## Как добраться')
  })

  it('formats nearby distance in metres and kilometres', () => {
    expect(formatDistance(0.476)).toBe('около 500 м')
    expect(formatDistance(2.84)).toBe('2,8 км')
    expect(formatDistance(12.2)).toBe('12 км')
  })
})
