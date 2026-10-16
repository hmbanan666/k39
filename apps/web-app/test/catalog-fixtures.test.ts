import { PRICE_CATALOG } from '@k39/database'
import { describe, expect, it } from 'vitest'
import { peersByItem } from '../server/utils/venues/comparable-prices'
import { FOOD_STICKERS } from '../shared/food-stickers'

describe('price catalog export', () => {
  it('lists the same slugs as the food stickers', () => {
    expect(PRICE_CATALOG.map((item) => item.slug).sort()).toEqual(Object.keys(FOOD_STICKERS).sort())
    expect(new Set(PRICE_CATALOG.map((item) => item.slug)).size).toBe(32)
  })

  it('groups comparable rows by item once', () => {
    const peers = peersByItem([
      { item: 'cappuccino', venueId: 'a', priceRub: 180 },
      { item: 'latte', venueId: 'a', priceRub: 200 },
      { item: 'cappuccino', venueId: 'b', priceRub: 220 },
    ])
    expect(peers.cappuccino).toHaveLength(2)
    expect(peers.latte).toHaveLength(1)
  })
})
