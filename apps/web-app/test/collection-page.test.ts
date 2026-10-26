import { describe, expect, it } from 'vitest'
import { collectionPlaceCards } from '../shared/collection-page'

describe('collection place cards', () => {
  it('maps places to cards with category, area, and a one-line summary', () => {
    expect(
      collectionPlaceCards([
        {
          slug: 'fringilla',
          title: 'Орнитологическая станция «Фрингилла»',
          summary: '  Полевой стационар.\nСезон и цены.  ',
          note: 'Заметка редактора',
          categorySlug: 'muzei',
          categoryTitle: 'Музеи',
          regionTitle: 'Зеленоградский муниципальный округ',
          regionSlug: 'zelenogradsk',
          regionShortTitle: 'Зеленоградск',
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
          regionTitle: 'Побережье',
          regionSlug: 'coast',
          regionShortTitle: null,
        },
      ]),
    ).toEqual([
      {
        href: '/fringilla',
        title: 'Орнитологическая станция «Фрингилла»',
        summary: 'Полевой стационар. Сезон и цены.',
        hub: 'Музеи',
        town: 'Зеленоградск и окрестности',
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
        town: 'Территория «Побережье»',
        kind: '',
      },
    ])
  })

  it('keeps unknown regions empty and does not duplicate explicit area labels', () => {
    expect(
      collectionPlaceCards([
        { slug: 'unknown', title: 'Без территории' },
        {
          slug: 'named',
          title: 'Предмет',
          regionSlug: 'baltiysk',
          regionTitle: 'Балтийск',
          regionShortTitle: 'Балтийск и окрестности',
        },
        { slug: 'custom', title: 'Другой предмет', regionSlug: 'coast', regionTitle: 'Побережье и окрестности' },
      ]).map((card) => card.town),
    ).toEqual(['', 'Балтийск и окрестности', 'Побережье и окрестности'])
  })
})
