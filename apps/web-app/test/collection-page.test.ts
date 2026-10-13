import { describe, expect, it } from 'vitest'
import { collectionPlaceCards } from '../shared/collection-page'

describe('collection place cards', () => {
  it('maps places to cards with category, town, and a one-line summary', () => {
    expect(collectionPlaceCards([
      {
        slug: 'fringilla',
        title: 'Орнитологическая станция «Фрингилла»',
        summary: '  Полевой стационар.\nСезон и цены.  ',
        note: 'Заметка редактора',
        categorySlug: 'muzei',
        categoryTitle: 'Музеи',
        regionTitle: 'Зеленоградский муниципальный округ',
      },
      {
        slug: 'vysota-efa',
        title: 'Высота Эфа',
        summary: '   ',
        note: ' Дюны с обзора ',
        categorySlug: 'plyazhi',
        categoryTitle: 'Пляжи',
        regionTitle: null,
      },
      {
        slug: 'zamok',
        title: 'Замок',
        summary: null,
        note: null,
        categorySlug: null,
        categoryTitle: null,
        regionTitle: 'Багратионовский муниципальный округ',
      },
    ])).toEqual([
      {
        href: '/fringilla',
        title: 'Орнитологическая станция «Фрингилла»',
        summary: 'Полевой стационар. Сезон и цены.',
        hub: 'Музеи',
        town: 'Зеленоградский муниципальный округ',
        kind: 'muzei',
      },
      {
        href: '/vysota-efa',
        title: 'Высота Эфа',
        summary: 'Дюны с обзора',
        hub: 'Пляжи',
        town: '',
        kind: 'plyazhi',
      },
      {
        href: '/zamok',
        title: 'Замок',
        summary: '',
        hub: '',
        town: 'Багратионовский муниципальный округ',
        kind: '',
      },
    ])
  })
})
