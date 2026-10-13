import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../shared/markdown'
import {
  activeHeadingId,
  headingId,
  readerOutline,
  readerPartner,
  readerTree,
  showReaderToc,
  splitAfterFirstSection,
} from '../shared/reader-nav'

const guide = [
  'Вступление про октябрь.',
  '',
  '## Погода',
  '',
  'Дождливо.',
  '',
  '### Ветер',
  '',
  'С залива.',
  '',
  '## Куда поехать',
  '',
  'На косу.',
  '',
  '## Что взять',
  '',
  'Плащ.',
].join('\n')

describe('reader navigation', () => {
  it('gives Cyrillic headings stable latin ids and keeps duplicates distinct', () => {
    const used = new Map<string, number>()
    expect(headingId('Как добраться', used)).toBe('kak-dobratsya')
    expect(headingId('Ёлка и «Дёнхофф»', used)).toBe('elka-i-denhoff')
    expect(headingId('Как добраться', used)).toBe('kak-dobratsya-2')
    expect(headingId('3 форта', used)).toBe('s-3-forta')
    expect(headingId('***', used)).toBe('section')

    const html = renderMarkdown('## **Как добраться**\n\nТекст.\n\n## Как добраться\n\nЕщё.')
    expect(html).toContain('<h2 id="kak-dobratsya"><strong>Как добраться</strong></h2>')
    expect(html).toContain('<h2 id="kak-dobratsya-2">Как добраться</h2>')
  })

  it('prefixes a second render so ids on one page do not collide', () => {
    const article = renderMarkdown('## На автобусе\n\nОт вокзала.')
    const directions = renderMarkdown('## На автобусе\n\nДругой абзац.', { headingPrefix: 'directions-' })
    expect(article).toContain('id="na-avtobuse"')
    expect(directions).toContain('id="directions-na-avtobuse"')
  })

  it('builds a table of contents from rendered h2 and h3 headings', () => {
    const html = renderMarkdown(guide)
    expect(readerOutline(html)).toEqual([
      { id: 'pogoda', text: 'Погода', level: 2 },
      { id: 'veter', text: 'Ветер', level: 3 },
      { id: 'kuda-poehat', text: 'Куда поехать', level: 2 },
      { id: 'chto-vzyat', text: 'Что взять', level: 2 },
    ])
    expect(readerTree(html)).toEqual([
      { id: 'pogoda', text: 'Погода', children: [{ id: 'veter', text: 'Ветер' }] },
      { id: 'kuda-poehat', text: 'Куда поехать', children: [] },
      { id: 'chto-vzyat', text: 'Что взять', children: [] },
    ])
    expect(showReaderToc(html)).toBe(true)
  })

  it('hides the table when the body has fewer than three h2 sections', () => {
    const two = renderMarkdown([
      '## Один',
      '',
      '### Вложенный',
      '',
      '### Ещё',
      '',
      '## Два',
    ].join('\n'))
    expect(showReaderToc(two)).toBe(false)
    expect(readerOutline(two)).toHaveLength(4)
    expect(showReaderToc('')).toBe(false)
  })

  it('splits the article after the first h2 section', () => {
    const html = renderMarkdown(guide)
    const parts = splitAfterFirstSection(html)
    expect(parts.before).toContain('id="pogoda"')
    expect(parts.before).toContain('id="veter"')
    expect(parts.before).not.toContain('id="kuda-poehat"')
    expect(parts.after.startsWith('<h2 id="kuda-poehat">')).toBe(true)
    expect(splitAfterFirstSection('<p>Без заголовков</p>')).toEqual({
      before: '<p>Без заголовков</p>',
      after: '',
    })
  })

  it('marks the last heading that has reached the header line', () => {
    const headings = [
      { id: 'pogoda', top: 400 },
      { id: 'veter', top: 280 },
      { id: 'kuda-poehat', top: 160 },
    ]
    expect(activeHeadingId(headings, 120)).toBe('')
    expect(activeHeadingId([
      { id: 'pogoda', top: 80 },
      { id: 'veter', top: 240 },
    ], 120)).toBe('pogoda')
    expect(activeHeadingId([
      { id: 'pogoda', top: -40 },
      { id: 'veter', top: 90 },
      { id: 'kuda-poehat', top: 400 },
    ], 120)).toBe('veter')
  })

  it('returns a partner only when the flag is on and the offer is complete', () => {
    const offer = { title: 'Кофе', terms: 'Второй напиток в подарок', href: '/zavedeniya/kofe', anchor: 'Подробнее' }
    expect(readerPartner(false, offer)).toBeNull()
    expect(readerPartner(true, null)).toBeNull()
    expect(readerPartner(true, { title: 'Кофе', terms: ' ', href: '/zavedeniya/kofe' })).toBeNull()
    expect(readerPartner(true, offer)).toEqual(offer)
    expect(readerPartner(true, { title: ' Кофе ', terms: ' Чашка ', href: ' /zavedeniya/kofe ' })).toEqual({
      title: 'Кофе',
      terms: 'Чашка',
      href: '/zavedeniya/kofe',
    })
  })
})
