import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SOURCE_LINK_LIMIT } from '@k39/database'
import { normalizeObjectSchema, safeParse } from '@modelcontextprotocol/sdk/server/zod-compat.js'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { contentGate, contentWarnings } from '../server/utils/content/save'
import { sources } from '../server/utils/mcp/schemas'
import { venueCreateSchema } from '../server/utils/venues/schema'
import { writingSplit } from '../shared/writing-split'

const EM = '\u2014'

describe('writing split', () => {
  const dishes = [{
    type: 'dishes',
    items: [
      { name: 'Пельмени по-домашнему', description: 'Бульон и сметана.' },
      { name: 'Лучший бургер' },
    ],
  }]
  const source = [{ title: `Меню на любой вкус ${EM} официальный сайт`, url: 'https://x.ru' }]

  it('lets official names publish and still blocks the same words in prose', () => {
    const clean = contentGate('venue', {
      name: 'Лучший бургер',
      description: 'Зал на втором этаже, обед до 16:00.',
      signatureDishes: [{ name: 'Пельмени по-домашнему', note: 'Порция с бульоном.' }],
      modules: dishes,
      sources: source,
      prices: [{ title: 'Лучший бургер', sourceTitle: `Меню на любой вкус ${EM} сайт`, sourceUrl: 'https://menu.example/b' }],
    }, true)
    expect(clean.names.join('\n')).toContain('Пельмени по-домашнему')
    expect(clean.names.join('\n')).toContain('Лучший бургер')
    expect(clean.names.join('\n')).toContain('на любой вкус')
    expect(clean.prose.join('\n')).not.toContain('по-домашнему')
    expect(contentWarnings(clean)).toEqual([])

    const dirty = contentGate('venue', {
      description: `Описание на любой вкус ${EM} и по-домашнему. Лучший зал.`,
      modules: dishes,
      sources: source,
    }, true)
    expect(() => contentWarnings(dirty)).toThrow(/Нельзя опубликовать/)
    expect(contentWarnings({ ...dirty, publishing: false }).join(' ')).toMatch(/на любой вкус/)
    expect(contentWarnings({ ...dirty, publishing: false }).join(' ')).toMatch(/по-домашнему/)
    expect(contentWarnings({ ...dirty, publishing: false }).join(' ')).toMatch(/empty superlatives/)
    expect(contentWarnings({ ...dirty, publishing: false }).join(' ')).toMatch(/em dash/)
  })

  it('does not let a name finish a stop-list phrase that starts in prose', () => {
    const gate = contentGate('venue', {
      description: 'Текст на любой',
      name: 'вкус',
    }, true)
    expect(contentWarnings(gate)).toEqual([])
  })

  it('blocks a banned site in prose, names, and URLs', () => {
    for (const input of [
      { description: 'Ссылка на kgdmore.ru в тексте.' },
      { name: 'Кафе kgdmore.ru' },
      { website: 'https://kgdmore.ru/menu' },
      { sources: [{ title: 'Меню', url: 'https://kgdmore.ru/menu' }] },
      { socials: [{ network: 'vk', url: 'https://kgdmore.ru/club' }] },
    ]) {
      expect(() => contentWarnings(contentGate('venue', input, true)), JSON.stringify(input)).toThrow(/kgdmore\.ru/)
    }
  })

  it('keeps venue price rules on prose and off dish names', () => {
    const named = contentGate('venue', {
      description: 'Обед в зале.',
      signatureDishes: [{ name: 'Обед 250 ₽ и ужин 320 ₽' }],
    }, true)
    expect(contentWarnings(named)).toEqual([])
    const told = contentGate('venue', {
      description: 'Обед 250 ₽ и ужин 320 ₽. Цены могли измениться.',
    }, true)
    expect(() => contentWarnings(told)).toThrow(/price retelling/)
  })

  it('splits place, collection, and route the same way', () => {
    const place = contentGate('place', {
      title: 'Форт у дороги',
      body: 'Форт у дороги.',
      sources: [{ title: `Страница ${EM} на любой вкус`, url: 'https://fort.example' }],
    }, true)
    expect(contentWarnings(place)).toEqual([])
    expect(() => contentWarnings(contentGate('place', { body: `Форт ${EM} музей` }, true))).toThrow(/em dash/)

    const collection = contentGate('collection', {
      title: 'Октябрь',
      copy: 'В октябре открыты форты.',
      modules: [{ type: 'text', text: 'В октябре открыты форты.' }],
      sources: [{ title: 'Калининградстат — сводка', url: 'https://example.com/oct' }],
      items: [{ placeSlug: 'fort-11', note: 'Короткий заход.' }],
    }, true)
    expect(collection.names.join('\n')).toContain('Калининградстат')
    expect(collection.prose.join('\n')).toContain('Короткий заход')
    expect(contentWarnings(collection)).toEqual([])
    expect(() => contentWarnings(contentGate('collection', { copy: 'уютная атмосфера' }, true))).toThrow(/уютная атмосфера/)

    const route = contentGate('route', {
      title: 'По фортам',
      sections: [{ kind: 'text', text: 'Сначала вал, потом ров.' }],
      points: [{ placeSlug: 'fort-11', note: 'Смотровая площадка.' }],
      sources: [{ title: `Нить ${EM} маршрута`, url: 'https://example.com/route' }],
    }, true)
    expect(contentWarnings(route)).toEqual([])
    expect(() => contentWarnings(contentGate('route', {
      sections: [{ kind: 'text', text: 'уютная атмосфера' }],
    }, true))).toThrow(/уютная атмосфера/)
  })

  it('is the split the venue writer calls', () => {
    const source = readFileSync(resolve(import.meta.dirname, '../server/utils/venues/write.ts'), 'utf8')
    expect(source).toContain('contentGate(\'venue\'')
    const split = writingSplit('venue', { name: 'Лучший', description: 'Зал.' })
    expect(split.names).toEqual(['Лучший'])
    expect(split.prose).toEqual(['Зал.'])
  })
})

describe('source link schema', () => {
  it('stays an object schema the MCP server can register', () => {
    const listed = normalizeObjectSchema(z.object(venueCreateSchema))
    expect(listed).toBeTruthy()
    const merged = safeParse(listed, {
      name: 'Кафе',
      kind: 'cafe',
      sources: [
        { title: 'Сайт', url: 'https://www.Example.com/menu/' },
        { title: 'Дубль', url: 'http://example.com/menu' },
      ],
    })
    expect(merged.success).toBe(true)
    if (merged.success) {
      expect(merged.data.sources).toEqual([{ title: 'Сайт', url: 'https://www.Example.com/menu/' }])
    }
    const bad = safeParse(listed, {
      name: 'Кафе',
      kind: 'cafe',
      sources: [{ title: 'Меню', url: 'ftp://example.com/a' }],
    })
    expect(bad.success).toBe(false)
  })

  it('merges duplicate URLs before the limit and names an invalid row', () => {
    const dupes = Array.from({ length: SOURCE_LINK_LIMIT + 6 }, () => ({
      title: 'Меню',
      url: 'https://www.Example.com/menu/',
    }))
    const merged = sources.safeParse(dupes)
    expect(merged.success).toBe(true)
    if (merged.success) {
      expect(merged.data).toEqual([{ title: 'Меню', url: 'https://www.Example.com/menu/' }])
    }

    const mixed = sources.safeParse([
      { title: 'Сайт', url: 'HTTP://WWW.Example.com/menu/' },
      { title: 'Дубль', url: 'http://example.com/menu' },
      { title: 'Карта', url: 'https://example.com/map' },
    ])
    expect(mixed.success).toBe(true)
    if (mixed.success) {
      expect(mixed.data).toEqual([
        { title: 'Сайт', url: 'HTTP://WWW.Example.com/menu/' },
        { title: 'Карта', url: 'https://example.com/map' },
      ])
    }

    const unique = Array.from({ length: SOURCE_LINK_LIMIT + 1 }, (_, index) => ({
      title: `Источник ${index + 1}`,
      url: `https://example.com/${index}`,
    }))
    const over = sources.safeParse(unique)
    expect(over.success).toBe(false)
    if (!over.success) {
      expect(over.error.issues.map((issue) => issue.message).join(' ')).toMatch(/Не больше/)
    }

    const missing = sources.safeParse([
      { title: 'Сайт', url: 'https://example.com' },
      { title: '  ', url: 'https://example.com/x' },
    ])
    expect(missing.success).toBe(false)
    if (!missing.success) {
      expect(missing.error.issues.map((issue) => issue.message).join(' ')).toContain('Источник 2')
    }

    expect(sources.safeParse(undefined)).toMatchObject({ success: true, data: undefined })
    const empty = sources.safeParse([])
    expect(empty.success).toBe(true)
    if (empty.success) {
      expect(empty.data).toEqual([])
    }

    const badUrl = sources.safeParse([{ title: 'Меню', url: 'ftp://example.com/a' }])
    expect(badUrl.success).toBe(false)
    if (!badUrl.success) {
      expect(badUrl.error.issues.map((issue) => issue.message).join(' ')).toMatch(/Источник 1/)
      expect(badUrl.error.issues.map((issue) => issue.message).join(' ')).toMatch(/http/)
    }
  })
})
