import { inArray } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { useDatabase } from '../../database'
import { venues } from '../../tables'
import { Editor } from '../content'
import { normalizePriceItemImage, Prices } from '../prices'
import { Venues } from '../venues'

const DAY = 86_400_000

function description() {
  return 'Кафе для проверки цен варит кофе и кормит обедом. '.repeat(8).slice(0, 420)
}

describe('price catalog', () => {
  const created: string[] = []

  afterEach(async () => {
    if (created.length) {
      await useDatabase().delete(venues).where(inArray(venues.id, created))
      created.length = 0
    }
  })

  it('lists fresh published prices of one item, cheapest first', async () => {
    const region = await Editor.upsertRegion({ slug: 'price-compare-town', title: 'Город цен' })
    const other = await Editor.upsertRegion({ slug: 'price-compare-other', title: 'Другой город' })
    const today = new Date().toISOString().slice(0, 10)
    const old = new Date(Date.now() - 400 * DAY).toISOString().slice(0, 10)
    const cheap = await Venues.create({
      name: 'Дешёвое кафе цен',
      slug: 'price-cheap-cafe',
      kind: 'cafe',
      status: 'published',
      description: description(),
      regionId: region.id,
    })
    created.push(cheap.id)
    const dear = await Venues.create({
      name: 'Дорогое кафе цен',
      slug: 'price-dear-cafe',
      kind: 'cafe',
      status: 'published',
      description: description(),
      regionId: region.id,
    })
    created.push(dear.id)
    const elsewhere = await Venues.create({
      name: 'Кафе другого города',
      slug: 'price-other-cafe',
      kind: 'cafe',
      status: 'published',
      description: description(),
      regionId: other.id,
    })
    created.push(elsewhere.id)
    const draft = await Venues.create({
      name: 'Черновик цен',
      slug: 'price-draft-cafe',
      kind: 'cafe',
      status: 'draft',
      regionId: region.id,
    })
    created.push(draft.id)
    const stale = await Venues.create({
      name: 'Старая цена',
      slug: 'price-stale-cafe',
      kind: 'cafe',
      status: 'published',
      description: description(),
      regionId: region.id,
    })
    created.push(stale.id)
    const row = (priceRub: number, checkedAt: string) => ({
      item: 'cappuccino',
      priceRub,
      checkedAt,
      sourceKind: 'official' as const,
      sourceTitle: 'Меню на сайте заведения',
      sourceUrl: 'https://cafe.example/menu',
    })
    await Prices.setForVenue(cheap.id, [row(150, today), { ...row(220, today), variant: '400 мл' }])
    await Prices.setForVenue(dear.id, [row(280, today)])
    await Prices.setForVenue(elsewhere.id, [row(90, today)])
    await Prices.setForVenue(draft.id, [row(50, today)])
    await Prices.setForVenue(stale.id, [row(40, old)])

    const listed = (await Prices.forItem('cappuccino')).filter((item) => created.includes(item.venueId))
    expect(listed.map((item) => item.priceRub)).toEqual([90, 150, 220, 280])
    expect(listed.map((item) => item.venueId)).toEqual([elsewhere.id, cheap.id, cheap.id, dear.id])
    expect(listed.find((item) => item.venueId === cheap.id)?.regionId).toBe(region.id)
    const fresh = await Prices.freshForVenue(stale.id)
    expect(fresh).toEqual([])
    const own = await Prices.freshForVenue(cheap.id)
    expect(own.map((item) => item.priceRub).sort((a, b) => a - b)).toEqual([150, 220])
  })

  it('stores an optional catalog picture and keeps it when an update omits it', async () => {
    expect(() => normalizePriceItemImage('javascript:alert(1)')).toThrow(/Картинка/)
    const row = await Prices.upsertItem({
      slug: 'latte',
      title: 'Латте',
      category: 'coffee',
      image: '/stickers/latte.webp',
    })
    expect(row?.image).toBe('/stickers/latte.webp')
    const kept = await Prices.upsertItem({ slug: 'latte', title: 'Латте', category: 'coffee' })
    expect(kept?.image).toBe('/stickers/latte.webp')
    const cleared = await Prices.upsertItem({ slug: 'latte', title: 'Латте', category: 'coffee', image: null })
    expect(cleared?.image).toBeNull()
  })
})
