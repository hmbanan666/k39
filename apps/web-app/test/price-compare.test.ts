import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PriceListing from '../app/components/PriceListing.vue'
import Sticker from '../app/components/Sticker.vue'
import VenueModules from '../app/components/VenueModules.vue'
import { TABLER_ICONS } from '../shared/icons'
import {
  buildPublicPrices,
  byTown,
  compareVenuePrice,
  formatTownRange,
  indexablePriceLocs,
  inPlace,
  isPriceIndexable,
  knownPortion,
  ofTown,
  onePricePerVenue,
  placesLabel,
  placesOutOf,
  PRICE_CATEGORY_ICONS,
  PRICE_ITEM_ICONS,
  PRICE_ITEM_IMAGES,
  PRICE_STICKER_WIDTH,
  priceBadgeFromBand,
  priceBandFromBands,
  priceBlockSummary,
  priceCardTap,
  priceCompareLead,
  priceItemIcon,
  priceItemImage,
  priceItemSticker,
  priceListingMeta,
  priceListNode,
  safePriceImage,
  sharedPriceSource,
} from '../shared/price-compare'
import { collectionDocument, schemaProblems } from '../shared/seo'
import { presentVenueBlocks, toPublicVenueModules } from '../shared/venue-modules'

vi.mock('~/composables/usePublicHead', () => ({
  usePublicHead: () => {},
}))

const REGION = 'svet'

function peer(venueId: string, priceRub: number, variant = '300 мл', regionId: string | null = REGION) {
  return { venueId, regionId, variant, priceRub, checkedAt: '2026-10-01' }
}

function compare(priceRub: number, peers: ReturnType<typeof peer>[], variant = '300 мл') {
  return compareVenuePrice({
    venueId: 'self',
    priceRub,
    variant,
    regionId: REGION,
    place: 'Светлогорска',
    where: 'в Светлогорске',
    by: 'Светлогорску',
    peers,
  })
}

describe('price comparison', () => {
  it('names the only price, a two-venue range, and a rank from three venues', () => {
    expect(compare(220, [])).toMatchObject({
      band: null,
      position: null,
      line: 'Пока единственная цена',
      scaleLabel: '',
      town: { medianRub: 220, minRub: 220, maxRub: 220, places: 1, where: 'В Светлогорске' },
    })
    expect(compare(220, [peer('a', 180)])).toMatchObject({
      band: null,
      position: null,
      line: 'Пока мало данных для сравнения',
      scaleLabel: '',
      town: { medianRub: 200, minRub: 180, maxRub: 220, places: 2, where: 'В Светлогорске' },
    })
    expect(compare(180, [peer('a', 180)]).town).toMatchObject({ minRub: 180, maxRub: 180, places: 2 })
    const ranked = compare(300, [peer('a', 100), peer('b', 150)])
    expect(ranked.band).toBe('expensive')
    expect(ranked.position).not.toBeNull()
    expect(ranked.line).toBe('Дороже, чем в 2 из 3 мест Светлогорска')
  })

  it('uses Russian plurals for the range and for «из N»', () => {
    expect(placesLabel(1)).toBe('1 место')
    expect(placesLabel(2)).toBe('2 места')
    expect(placesLabel(3)).toBe('3 места')
    expect(placesLabel(4)).toBe('4 места')
    expect(placesLabel(5)).toBe('5 мест')
    expect(placesLabel(11)).toBe('11 мест')
    expect(placesLabel(21)).toBe('21 место')
    expect(placesLabel(22)).toBe('22 места')
    expect(placesOutOf(1)).toBe('1 места')
    expect(placesOutOf(2)).toBe('2 мест')
    expect(placesOutOf(3)).toBe('3 мест')
    expect(placesOutOf(4)).toBe('4 мест')
    expect(placesOutOf(5)).toBe('5 мест')
    expect(placesOutOf(11)).toBe('11 мест')
    expect(placesOutOf(21)).toBe('21 места')
    expect(placesOutOf(22)).toBe('22 мест')
    const twenty = Array.from({ length: 20 }, (_, index) => peer(`p${index}`, 100 + index))
    expect(compare(90, twenty).line).toBe('Дешевле, чем в 20 из 21 места Светлогорска')
    const twentyOne = Array.from({ length: 21 }, (_, index) => peer(`q${index}`, 200))
    expect(compare(100, twentyOne).line).toBe('Дешевле, чем в 21 из 22 мест Светлогорска')
  })

  it('puts the town in the prepositional, the genitive, and the dative', () => {
    const towns: Array<[string, string, string, string]> = [
      ['kaliningrad', 'Калининграда', 'Калининграду', 'в Калининграде'],
      ['svetlogorsk', 'Светлогорска', 'Светлогорску', 'в Светлогорске'],
      ['zelenogradsk', 'Зеленоградска', 'Зеленоградску', 'в Зеленоградске'],
      ['yantarnyy', 'Янтарного', 'Янтарному', 'в Янтарном'],
      ['baltiysk', 'Балтийска', 'Балтийску', 'в Балтийске'],
      ['sovetsk', 'Советска', 'Советску', 'в Советске'],
      ['pionerskiy', 'Пионерского', 'Пионерскому', 'в Пионерском'],
      ['chernyakhovsk', 'Черняховска', 'Черняховску', 'в Черняховске'],
      ['gusev', 'Гусева', 'Гусеву', 'в Гусеве'],
      ['gvardeysk', 'Гвардейска', 'Гвардейску', 'в Гвардейске'],
      ['guryevsk', 'Гурьевска', 'Гурьевску', 'в Гурьевске'],
      ['bagrationovsk', 'Багратионовска', 'Багратионовску', 'в Багратионовске'],
      ['mamonovo', 'Мамоново', 'Мамоново', 'в Мамоново'],
      ['neman', 'Немана', 'Неману', 'в Немане'],
      ['polessk', 'Полесска', 'Полесску', 'в Полесске'],
      ['pravdinsk', 'Правдинска', 'Правдинску', 'в Правдинске'],
    ]
    for (const [slug, genitive, dative, prepositional] of towns) {
      expect(ofTown(slug)).toBe(genitive)
      expect(byTown(slug)).toBe(dative)
      expect(inPlace(slug)).toBe(prepositional)
    }
    expect(inPlace('missing')).toBe('в регионе')
    expect(inPlace(null)).toBe('в регионе')
    expect(byTown('missing')).toBe('региону')
    expect(byTown(null)).toBe('региону')
    expect(priceCompareLead('svetlogorsk')).toBe('Сравниваем с другими заведениями Светлогорска')
    expect(priceCompareLead('kaliningrad')).toBe('Сравниваем с другими заведениями Калининграда')
    expect(priceCompareLead(null)).toBe('Сравниваем с другими заведениями региона')
    const only = compareVenuePrice({
      venueId: 'self',
      priceRub: 160,
      variant: '30 мл',
      regionId: REGION,
      place: ofTown('zelenogradsk'),
      where: inPlace('zelenogradsk'),
      by: byTown('zelenogradsk'),
      peers: [],
    })
    expect(only.line).toBe('Пока единственная цена')
    expect(only.scaleLabel).toBe('')
    const pair = compareVenuePrice({
      venueId: 'self',
      priceRub: 250,
      variant: '300 мл',
      regionId: null,
      place: ofTown(null),
      where: inPlace(null),
      by: byTown(null),
      peers: [peer('a', 180, '300 мл', null)],
    })
    expect(pair.line).toBe('Пока мало данных для сравнения')
    expect(pair.town.where).toBe('В регионе')
    expect(pair.scaleLabel).toBe('')
  })

  it('places a price against the regional median and counts dearer venues', () => {
    const peers = [100, 120, 200, 210, 220, 230, 240, 250, 400].map((price, index) => peer(`v${index}`, price))
    const result = compare(180, peers)
    expect(result.band).toBe('cheap')
    expect(result.position).toBe(23)
    expect(result.line).toBe('Дешевле, чем в 7 из 10 мест Светлогорска')
    expect(result.town).toEqual({ medianRub: 215, minRub: 100, maxRub: 400, places: 10, where: 'В Светлогорске' })
    expect(result.scaleLabel).toBe('Дешевле медианы по Светлогорску')
  })

  it('calls the expensive end of a large sample a top price in that town', () => {
    const peers = [100, 110, 120, 130, 140, 150, 160].map((price, index) => peer(`v${index}`, price))
    const top = compare(400, peers)
    expect(top.line).toBe('Топ-3 по цене в Светлогорске')
    expect(top.band).toBe('expensive')
    expect(top.scaleLabel).toBe('Дороже медианы по Светлогорску')
    const unknown = compareVenuePrice({
      venueId: 'self',
      priceRub: 400,
      variant: '300 мл',
      regionId: null,
      place: ofTown(null),
      where: inPlace(null),
      by: byTown(null),
      peers: peers.map((row) => ({ ...row, regionId: null })),
    })
    expect(unknown.line).toBe('Топ-3 по цене в регионе')
    expect(unknown.scaleLabel).toBe('Дороже медианы по региону')
  })

  it('does not call three venues a top-3', () => {
    const result = compare(300, [peer('a', 100), peer('b', 150)])
    expect(result.band).toBe('expensive')
    expect(result.line).toBe('Дороже, чем в 2 из 3 мест Светлогорска')
  })

  it('says the price matches the others when every venue charges the same', () => {
    const result = compare(200, [peer('a', 200), peer('b', 200), peer('c', 200), peer('d', 200)])
    expect(result.band).toBe('medium')
    expect(result.position).toBe(50)
    expect(result.line).toBe('Как в других местах Светлогорска')
    expect(result.scaleLabel).toBe('Около медианы по Светлогорску')
  })

  it('ignores other regions and prefers the same portion', () => {
    const peers = [
      peer('a', 100, '200 мл'),
      peer('a', 250, '300 мл'),
      peer('b', 240),
      peer('c', 260),
      peer('far', 50, '300 мл', 'other'),
    ]
    const result = compare(220, peers)
    expect(result.band).toBe('cheap')
    expect(result.line).toBe('Дешевле, чем в 3 из 4 мест Светлогорска')
  })

  it('names icons per catalog item and falls back by category, then ticket', () => {
    const slugs = ['latte', 'raf', 'espresso', 'pepperoni', 'carbonara', 'shawarma', 'pelmeni', 'bliny', 'tom-yum', 'ramen', 'salmon-steak', 'draniki', 'klopsy', 'mors', 'lemonade', 'mulled-wine', 'croissant', 'cheesecake', 'syrniki', 'tea-lemon', 'orange-juice', 'beer', 'margherita', 'burger', 'philadelphia', 'caesar', 'borscht', 'ukha', 'smoked-fish', 'business-lunch', 'americano', 'cappuccino']
    const categories = ['coffee', 'bakery', 'dessert', 'breakfast', 'tea', 'drinks', 'beer', 'pizza', 'burger', 'street-food', 'sushi', 'salad', 'soup', 'pasta', 'main', 'fish', 'lunch']
    for (const slug of slugs) {
      expect(PRICE_ITEM_ICONS[slug] in TABLER_ICONS).toBe(true)
    }
    for (const category of categories) {
      expect(PRICE_CATEGORY_ICONS[category] in TABLER_ICONS).toBe(true)
      expect(priceItemIcon(`new-${category}`, category)).toBe(PRICE_CATEGORY_ICONS[category])
    }
    expect(priceItemIcon('unknown', 'nope')).toBe('price')
    expect(safePriceImage('javascript:alert(1)')).toBeNull()
    expect(priceItemImage('latte', 'https://cdn.example/latte.webp')).toBe('https://cdn.example/latte.webp')
    expect(priceItemImage('latte', null)).toBeNull()
    expect(priceItemSticker('latte', null)).toBe('latte')
    expect(priceItemSticker('latte', 'https://cdn.example/latte.webp')).toBeNull()
    expect(priceItemSticker('kvass', null)).toBeNull()
    expect(PRICE_STICKER_WIDTH).toBeGreaterThanOrEqual(48)
    expect(PRICE_STICKER_WIDTH).toBeLessThanOrEqual(64)
    for (const slug of slugs) {
      expect(priceItemSticker(slug, null)).toBe(slug)
      expect(priceItemSticker(slug, '/stickers/custom.webp')).toBeNull()
    }
    PRICE_ITEM_IMAGES.latte = '/stickers/latte.webp'
    expect(priceItemImage('latte', null)).toBe('/stickers/latte.webp')
    expect(priceItemSticker('latte', null)).toBeNull()
    expect(priceItemImage('latte', 'https://cdn.example/latte.webp')).toBe('https://cdn.example/latte.webp')
    delete PRICE_ITEM_IMAGES.latte
    expect(priceItemSticker('latte', null)).toBe('latte')
    expect(ofTown('svetlogorsk')).toBe('Светлогорска')
    expect(ofTown('missing')).toBe('региона')
    expect(ofTown(null)).toBe('региона')
  })

  it('keeps one price per venue, matching the portion when it exists', () => {
    const rows = onePricePerVenue([
      peer('a', 100, '200 мл'),
      peer('a', 250, '300 мл'),
      peer('b', 240),
    ], '300 мл')
    expect(rows.map((row) => [row.venueId, row.priceRub])).toEqual([['a', 250], ['b', 240]])
  })

  it('summarizes the cards and collapses one shared source', () => {
    expect(priceBlockSummary(['cheap', 'cheap', 'expensive'], 'svetlogorsk')).toEqual({ text: 'ниже среднего', label: 'Цены ниже среднего по Светлогорску' })
    expect(priceBlockSummary(['expensive', 'medium'], 'svetlogorsk')).toEqual({ text: 'выше среднего', label: 'Цены выше среднего по Светлогорску' })
    expect(priceBlockSummary(['medium', 'medium'], 'zelenogradsk')).toEqual({ text: 'около среднего', label: 'Цены около среднего по Зеленоградску' })
    expect(priceBlockSummary(['cheap'], 'yantarnyy')).toEqual({ text: 'ниже среднего', label: 'Цены ниже среднего по Янтарному' })
    expect(priceBlockSummary(['cheap'], 'mamonovo')).toEqual({ text: 'ниже среднего', label: 'Цены ниже среднего по Мамоново' })
    expect(priceBlockSummary(['cheap'], null)).toEqual({ text: 'ниже среднего', label: 'Цены ниже среднего по региону' })
    expect(priceBlockSummary(['expensive'], 'missing')).toEqual({ text: 'выше среднего', label: 'Цены выше среднего по региону' })
    expect(priceBlockSummary([null, null], 'svetlogorsk')).toBeNull()
    expect(priceBandFromBands(['cheap', 'cheap', 'expensive'])).toEqual({ level: 'low', basis: 3 })
    expect(priceBandFromBands(['expensive', 'medium'])).toEqual({ level: 'high', basis: 2 })
    expect(priceBandFromBands(['medium', 'medium'])).toEqual({ level: 'mid', basis: 2 })
    expect(priceBandFromBands([null, null])).toEqual({ level: null, basis: 0 })
    expect(priceBadgeFromBand('low', 'svetlogorsk')).toEqual(priceBlockSummary(['cheap'], 'svetlogorsk'))
    expect(priceBadgeFromBand(null, 'svetlogorsk')).toBeNull()
    const shared = sharedPriceSource([
      { sourceTitle: 'Старое меню', sourceUrl: 'https://cafe.example/menu', checkedAt: '2026-03-01' },
      { sourceTitle: 'Меню на сайте заведения', sourceUrl: 'https://cafe.example/menu', checkedAt: '2026-10-12' },
    ])
    expect(shared).toEqual({ title: 'Меню на сайте заведения', url: 'https://cafe.example/menu', date: '2026-10-12' })
    const mixed = sharedPriceSource([
      { sourceTitle: 'Меню доставки', sourceUrl: 'https://a.example/menu', checkedAt: '2026-10-01' },
      { sourceTitle: 'Сайт', sourceUrl: 'https://b.example', checkedAt: '2026-11-01' },
      { sourceTitle: 'Меню доставки', sourceUrl: 'https://a.example/menu', checkedAt: '2026-09-01' },
      { sourceTitle: 'Сообщено заведением', sourceUrl: null, checkedAt: '2026-12-01' },
    ])
    expect(mixed).toEqual({ title: 'Меню доставки', url: 'https://a.example/menu', date: '2026-10-01' })
    const tied = sharedPriceSource([
      { sourceTitle: 'Первое', sourceUrl: 'https://a.example', checkedAt: '2026-01-01' },
      { sourceTitle: 'Второе', sourceUrl: 'https://b.example', checkedAt: '2026-08-01' },
    ])
    expect(tied).toEqual({ title: 'Второе', url: 'https://b.example', date: '2026-08-01' })
    const plain = sharedPriceSource([
      { sourceTitle: 'Старое', sourceUrl: null, checkedAt: '2026-01-01' },
      { sourceTitle: 'Сообщено заведением', sourceUrl: null, checkedAt: '2026-06-01' },
    ])
    expect(plain).toEqual({ title: 'Сообщено заведением', url: null, date: '2026-06-01' })
    expect(knownPortion('300 мл')).toBe('300 мл')
    expect(knownPortion('объём не указан')).toBeNull()
    expect(knownPortion('')).toBeNull()
    expect(formatTownRange({ medianRub: 300, minRub: 185, maxRub: 420, places: 5, where: 'В Светлогорске' })).toBe('185–420 ₽')
    expect(priceCardTap({ finePointer: true, keyboard: false, open: false })).toBe('follow')
    expect(priceCardTap({ finePointer: false, keyboard: true, open: false })).toBe('follow')
    expect(priceCardTap({ finePointer: false, keyboard: false, open: true })).toBe('follow')
    expect(priceCardTap({ finePointer: false, keyboard: false, open: false })).toBe('open')
  })

  it('keeps a thin listing noindex and indexes one with five venues', () => {
    expect(isPriceIndexable(4)).toBe(false)
    expect(isPriceIndexable(5)).toBe(true)
    const thin = priceListingMeta({ title: 'Капучино', slug: 'cappuccino', regionSlug: 'svetlogorsk', regionName: 'Светлогорск', count: 4 })
    expect(thin.path).toBe('/ceny/cappuccino/svetlogorsk')
    expect(thin.h1).toBe('Капучино в Светлогорске')
    expect(thin.noindex).toBe(true)
    expect(thin.seoTitle).not.toContain('—')
    const ready = priceListingMeta({ title: 'Капучино', slug: 'cappuccino', regionSlug: null, regionName: '', count: 5 })
    const doc = collectionDocument({
      path: ready.path,
      h1: ready.h1,
      summary: ready.description,
      seoTitle: ready.seoTitle,
      noindex: ready.noindex,
      crumbName: 'список',
      parent: { name: 'Заведения', href: '/zavedeniya' },
      items: [],
      kind: 'CollectionPage',
    })
    expect(doc.title).toBe('Капучино: цены | K39')
    expect(doc.robots).not.toContain('noindex')
    expect(doc.canonical).toBe('https://k39.online/ceny/cappuccino')
    const locs = indexablePriceLocs([{
      slug: 'cappuccino',
      points: [
        { regionSlug: 'svetlogorsk', checkedAt: '2026-10-01' },
        { regionSlug: 'svetlogorsk', checkedAt: '2026-10-02' },
        { regionSlug: 'svetlogorsk', checkedAt: '2026-09-01' },
        { regionSlug: 'svetlogorsk', checkedAt: '2026-08-01' },
        { regionSlug: 'svetlogorsk', checkedAt: '2026-07-01' },
        { regionSlug: 'zelenogradsk', checkedAt: '2026-10-11' },
      ],
    }])
    expect(locs).toEqual([
      { loc: '/ceny/cappuccino', lastmod: '2026-10-11' },
      { loc: '/ceny/cappuccino/svetlogorsk', lastmod: '2026-10-02' },
    ])
  })

  it('builds cards from fresh peers and hides a prices module without rows', () => {
    expect(toPublicVenueModules([{ type: 'prices' }], (text) => text, [])).toBeNull()
    const cards = buildPublicPrices({
      venueId: 'self',
      venueSlug: 'bochka-pab',
      regionId: REGION,
      regionSlug: 'svetlogorsk',
      rows: [{
        item: 'cappuccino',
        title: 'Капучино',
        category: 'coffee',
        variant: '300 мл',
        priceRub: 180,
        checkedAt: '2026-10-01',
        sourceTitle: 'Меню на сайте заведения',
        sourceUrl: 'https://cafe.example/menu',
      }],
      peersByItem: {
        cappuccino: [100, 120, 200, 210, 220, 230, 240, 250, 400].map((price, index) => peer(`v${index}`, price)),
      },
    })
    expect(cards[0]?.href).toBe('/ceny/cappuccino/svetlogorsk?from=bochka-pab')
    expect(cards[0]?.icon).toBe('coffee')
    expect(cards[0]?.image).toBeNull()
    expect(cards[0]?.sticker).toBe('cappuccino')
    expect(cards[0]?.comparison.line).toBe('Дешевле, чем в 7 из 10 мест Светлогорска')
    const pictured = buildPublicPrices({
      venueId: 'self',
      regionId: REGION,
      regionSlug: 'svetlogorsk',
      rows: [{
        item: 'cappuccino',
        title: 'Капучино',
        category: 'coffee',
        variant: '300 мл',
        priceRub: 180,
        checkedAt: '2026-10-01',
        sourceTitle: 'Меню',
        sourceUrl: null,
        image: 'https://cdn.example/cup.webp',
      }],
      peersByItem: {},
    })
    expect(pictured[0]?.image).toBe('https://cdn.example/cup.webp')
    expect(pictured[0]?.sticker).toBeNull()
    const plain = buildPublicPrices({
      venueId: 'self',
      regionId: REGION,
      regionSlug: null,
      rows: [{
        item: 'kvass',
        title: 'Квас',
        category: 'drinks',
        variant: '300 мл',
        priceRub: 120,
        checkedAt: '2026-10-01',
        sourceTitle: 'Меню',
        sourceUrl: null,
      }],
      peersByItem: {},
    })
    expect(plain[0]?.sticker).toBeNull()
    expect(plain[0]?.icon).toBe('glass')
    const hidden = toPublicVenueModules([{ type: 'prices' }], (text) => text, cards, { regionSlug: 'svetlogorsk' })
    expect(hidden?.blocks[0]).toMatchObject({ type: 'prices', summary: null })
    const out = toPublicVenueModules([{ type: 'prices' }], (text) => text, cards, { regionSlug: 'svetlogorsk', priceBand: 'low' })
    expect(out?.blocks[0]).toMatchObject({
      type: 'prices',
      summary: { text: 'ниже среднего', label: 'Цены ниже среднего по Светлогорску' },
      source: { title: 'Меню на сайте заведения', url: 'https://cafe.example/menu', date: '2026-10-01' },
    })
    const list = priceListNode(cards, 'Ориентиры цен')
    expect(list?.itemListElement[0]).toMatchObject({
      position: 1,
      item: {
        '@type': 'Offer',
        'name': 'Капучино, 300 мл',
        'price': 180,
        'priceCurrency': 'RUB',
        'url': 'https://cafe.example/menu',
        'description': 'Меню на сайте заведения',
        'validFrom': '2026-10-01',
      },
    })
    expect(priceListNode([], 'Ориентиры цен')).toBeNull()
    expect(list && schemaProblems([{ '@context': 'https://schema.org', ...list }])).toEqual([])
    expect(cards[0]?.comparison.scaleLabel).toBe('Дешевле медианы по Светлогорску')
    const unnamed = toPublicVenueModules([{ type: 'prices' }], (text) => text, cards, { priceBand: 'low' })
    expect(unnamed?.blocks[0]).toMatchObject({ summary: { text: 'ниже среднего', label: 'Цены ниже среднего по региону' } })
  })
})

describe('price cards', () => {
  const card = {
    slug: 'cappuccino',
    title: 'Капучино',
    variant: '300 мл',
    priceRub: 180,
    checkedAt: '2026-10-01',
    sourceTitle: 'Меню на сайте заведения',
    sourceUrl: 'https://cafe.example/menu',
    icon: 'coffee',
    image: null,
    sticker: 'cappuccino' as const,
    href: '/ceny/cappuccino/svetlogorsk',
    comparison: {
      band: 'cheap' as const,
      position: 23,
      line: 'Дешевле, чем в 7 из 10 мест Светлогорска',
      scaleLabel: 'Дешевле медианы по Светлогорску',
      town: { medianRub: 215, minRub: 100, maxRub: 400, places: 10, where: 'В Светлогорске' },
    },
  }

  function mountPrices(items: typeof card[], summary: { text: string, label: string } | null, source: { title: string, url: string | null, date: string } | null) {
    return mount(VenueModules, {
      props: {
        blocks: [{
          type: 'prices',
          id: 'tseny',
          title: 'Ориентиры цен',
          lead: 'Сравниваем с другими заведениями Светлогорска',
          items,
          summary,
          source,
        }],
      },
      global: {
        components: { Sticker },
        stubs: {
          Icon: { props: ['name'], template: '<i class="stub-icon" :data-name="name" />' },
          UiLink: { props: ['href'], template: '<a class="stub-link" :href="href"><slot /></a>' },
          MetaLink: { props: ['href'], template: '<a :href="href"><slot /></a>' },
        },
      },
    })
  }

  it('renders the glance row, keeps the conclusion in the tooltip, and one source line', () => {
    const wrapper = mountPrices([card, { ...card, slug: 'americano', title: 'Американо', priceRub: 140, icon: 'cup', image: '/stickers/americano.webp', sticker: null, variant: 'объём не указан' }], { text: 'ниже среднего', label: 'Цены ниже среднего по Светлогорску' }, {
      title: 'Меню на сайте заведения',
      url: 'https://cafe.example/menu',
      date: '2026-10-01',
    })
    const cards = wrapper.findAll('.price-card')
    expect(cards).toHaveLength(2)
    expect(cards[0]?.attributes('href')).toBe('/ceny/cappuccino/svetlogorsk')
    expect(cards[0]?.attributes('aria-describedby')).toBe('tseny-d0')
    expect(cards[0]?.text()).toContain('Капучино')
    expect(cards[0]?.text()).toContain('300 мл')
    expect(cards[0]?.text()).toContain('180 ₽')
    expect(cards[0]?.text()).not.toContain('дешевле')
    expect(cards[0]?.text()).not.toContain('дёшево')
    expect(cards[0]?.find('.scale-labels').exists()).toBe(false)
    const detail = wrapper.get('#tseny-d0')
    expect(detail.attributes('role')).toBe('tooltip')
    expect(detail.text()).toContain('Дешевле, чем в 7 из 10 мест Светлогорска')
    expect(detail.text()).toContain('В Светлогорске')
    expect(detail.text()).toContain('Медиана: 215 ₽')
    expect(detail.text()).toContain('Диапазон: 100–400 ₽')
    expect(detail.text()).toContain('Мест: 10')
    expect(detail.text()).toContain('Порция: 300 мл')
    expect(detail.text()).not.toContain('дёшево')
    expect(wrapper.html()).toContain('Дешевле, чем в 7 из 10 мест Светлогорска')
    expect(wrapper.find('#tseny-d1').text()).not.toContain('Порция:')
    expect(cards[0]?.find('.price-art picture.sticker').exists()).toBe(true)
    const picture = cards[0]?.find('picture.sticker')
    expect(picture?.find('img').attributes('src')).toBe('/stickers/food/cappuccino-256.png')
    expect(picture?.find('img').attributes('alt')).toBe('')
    expect(picture?.find('img').attributes('width')).toBe(String(PRICE_STICKER_WIDTH))
    expect(picture?.find('source[type="image/avif"]').attributes('srcset')).toContain('/stickers/food/cappuccino-128.avif 128w')
    expect(picture?.find('source[type="image/avif"]').attributes('srcset')).toContain('/stickers/food/cappuccino-512.avif 512w')
    expect(picture?.find('source[type="image/avif"]').attributes('sizes')).toBe(`${PRICE_STICKER_WIDTH}px`)
    expect(picture?.find('source[type="image/webp"]').attributes('srcset')).toContain('/stickers/food/cappuccino-256.webp 256w')
    expect(cards[1]?.find('.price-art picture.sticker').exists()).toBe(false)
    expect(cards[1]?.find('.price-art img').attributes('src')).toBe('/stickers/americano.webp')
    expect(wrapper.findAll('.stub-icon')).toHaveLength(0)
    expect(wrapper.findAll('picture.sticker')).toHaveLength(1)
    expect(wrapper.text()).toContain('Сравниваем с другими заведениями Светлогорска')
    expect(cards[0]?.find('.scale').attributes('aria-label')).toBe('Дешевле медианы по Светлогорску')
    const badge = wrapper.get('.price-badge')
    expect(badge.text()).toBe('ниже среднего')
    expect(badge.attributes('title')).toBe('Цены ниже среднего по Светлогорску')
    expect(badge.attributes('aria-label')).toBe('Цены ниже среднего по Светлогорску')
    expect(wrapper.find('.price-chip').exists()).toBe(false)
    expect(wrapper.get('.price-head h2').text()).toBe('Ориентиры цен')
    const links = wrapper.findAll('.stub-link')
    expect(links).toHaveLength(1)
    expect(links[0]?.attributes('href')).toBe('https://cafe.example/menu')
    expect(wrapper.get('.price-foot time').attributes('datetime')).toBe('2026-10-01')
    expect(wrapper.findAll('.price-foot')).toHaveLength(1)
    expect(wrapper.get('.price-foot').text()).toContain('Меню на сайте заведения,')
    expect(wrapper.get('.price-foot').text()).toContain('Цены могли измениться.')
    expect(wrapper.text()).not.toContain('не меню целиком')
    expect(wrapper.find('.price-src').exists()).toBe(false)
  })

  it('shows one source line and a quiet mark when there is no scale', () => {
    const quiet = {
      band: null,
      position: null,
      line: 'Пока единственная цена',
      scaleLabel: '',
      town: { medianRub: 180, minRub: 180, maxRub: 180, places: 1, where: 'В Светлогорске' },
    }
    const wrapper = mountPrices([
      card,
      { ...card, slug: 'burger', title: 'Бургер', sticker: 'burger' as const, variant: '', sourceTitle: 'Сообщено заведением', sourceUrl: null, checkedAt: '2026-03-01', comparison: quiet },
    ], null, {
      title: 'Меню на сайте заведения',
      url: 'https://cafe.example/menu',
      date: '2026-10-15',
    })
    expect(wrapper.find('.price-chip').exists()).toBe(false)
    expect(wrapper.findAll('.scale:not(.scale-quiet)')).toHaveLength(1)
    expect(wrapper.findAll('.scale-quiet')).toHaveLength(1)
    expect(wrapper.find('#tseny-d1').text()).toContain('Пока единственная цена')
    expect(wrapper.find('#tseny-d1').text()).toContain('Мест: 1')
    expect(wrapper.find('.price-src').exists()).toBe(false)
    expect(wrapper.findAll('.price-sources')).toHaveLength(1)
    expect(wrapper.findAll('.price-foot a, .price-foot .stub-link')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Сообщено заведением')
    expect(wrapper.text()).not.toContain('проверено с')
    expect(wrapper.get('.price-foot').text()).toContain('Меню на сайте заведения,')
    expect(wrapper.get('.price-foot').text()).toContain('Цены могли измениться.')
    expect(wrapper.get('.price-foot time').attributes('datetime')).toBe('2026-10-15')
  })

  it('renders prices, then dishes, then the other modules', () => {
    const stored = [
      { type: 'text' as const, id: 'o-meste', title: 'О месте', variant: 'lead' as const, html: '<p>Про место.</p>' },
      { type: 'dishes' as const, id: 'chto-zakazat', title: 'Что заказать', note: null, items: [{ id: 'soup', name: 'Борщ', description: 'Со сметаной', priceRub: 450, media: null }] },
      { type: 'prices' as const, id: 'tseny', title: 'Ориентиры цен', lead: 'Сравниваем', items: [card], summary: null, source: null },
    ]
    expect(presentVenueBlocks(stored).map((block) => block.type)).toEqual(['prices', 'dishes', 'text'])
    expect(stored.map((block) => block.type)).toEqual(['text', 'dishes', 'prices'])
    const wrapper = mount(VenueModules, {
      props: { blocks: stored },
      global: {
        components: { Sticker },
        stubs: {
          Icon: true,
          UiLink: true,
          MetaLink: { props: ['href'], template: '<a :href="href"><slot /></a>' },
          ProseHtml: { props: ['html'], template: '<div class="prose-html" v-html="html" />' },
          MediaImage: true,
        },
      },
    })
    expect(wrapper.findAll('section.vm').map((section) => section.attributes('id'))).toEqual(['tseny', 'chto-zakazat', 'o-meste'])
    const dish = wrapper.get('#chto-zakazat .dish-card')
    expect(dish.text()).toContain('Борщ')
    expect(dish.text()).toContain('450 ₽')
    expect(dish.text()).not.toContain('Со сметаной')
    expect(wrapper.get('#chto-zakazat-d0').text()).toContain('Со сметаной')
    expect(wrapper.get('#chto-zakazat picture.sticker img').attributes('src')).toContain('cook-with-pan')
    expect(dish.attributes('tabindex')).toBe('0')
  })

  it('falls back to the line icon when the slug has no food sticker', () => {
    const wrapper = mountPrices([
      { ...card, slug: 'kvass', title: 'Квас', icon: 'glass', sticker: null },
    ], null, null)
    expect(wrapper.find('picture.sticker').exists()).toBe(false)
    expect(wrapper.find('.stub-icon').attributes('data-name')).toBe('tabler:glass')
  })

  it('shows one decorative food sticker on the price listing', () => {
    const doc = collectionDocument({
      path: '/ceny/cappuccino',
      h1: 'Капучино',
      summary: 'Капучино в области: свежие цены.',
      seoTitle: 'Капучино: цены',
      crumbName: 'список',
      parent: { name: 'Заведения', href: '/zavedeniya' },
      items: [],
      kind: 'CollectionPage',
    })
    const wrapper = mount(PriceListing, {
      props: {
        page: {
          doc,
          item: { slug: 'cappuccino', title: 'Капучино', image: null, sticker: 'cappuccino' },
          regionSlug: null,
          towns: [],
          oblastHref: '/ceny/cappuccino',
          items: [],
        },
      },
      global: {
        components: { Sticker },
        stubs: {
          PageHeader: { template: '<header><slot name="mark" /><h1>{{ h1 }}</h1><slot /></header>', props: ['h1'] },
          VenueCard: true,
        },
      },
    })
    const picture = wrapper.get('picture.sticker')
    expect(picture.find('img').attributes('alt')).toBe('')
    expect(picture.find('img').attributes('src')).toBe('/stickers/food/cappuccino-256.png')
    expect(picture.find('source[type="image/avif"]').attributes('sizes')).toBe(`${PRICE_STICKER_WIDTH}px`)
    expect(wrapper.text()).toContain('Капучино')

    const custom = mount(PriceListing, {
      props: {
        page: {
          doc,
          item: { slug: 'cappuccino', title: 'Капучино', image: 'https://cdn.example/cup.webp', sticker: null },
          regionSlug: null,
          towns: [],
          oblastHref: '/ceny/cappuccino',
          items: [],
        },
      },
      global: {
        components: { Sticker },
        stubs: {
          PageHeader: { template: '<header><slot name="mark" /><slot /></header>' },
          VenueCard: true,
        },
      },
    })
    expect(custom.find('picture.sticker').exists()).toBe(false)
    expect(custom.get('img.item-art').attributes('src')).toBe('https://cdn.example/cup.webp')
    expect(custom.get('img.item-art').attributes('alt')).toBe('')
  })

  it('highlights the venue from the query and leaves the cheaper ones unmarked', () => {
    const doc = collectionDocument({
      path: '/ceny/cappuccino/svetlogorsk',
      h1: 'Капучино в Светлогорске',
      summary: 'Капучино в Светлогорске: свежие цены.',
      seoTitle: 'Капучино в Светлогорске: цены',
      crumbName: 'список',
      parent: { name: 'Капучино', href: '/ceny/cappuccino' },
      items: [],
      kind: 'CollectionPage',
    })
    const venue = {
      kindLabel: 'Бар',
      media: null,
      schedule: null,
      stale: false,
      meta: '',
      variant: '300 мл',
    }
    const wrapper = mount(PriceListing, {
      props: {
        from: 'bochka-pab',
        page: {
          doc,
          item: { slug: 'cappuccino', title: 'Капучино', image: null, sticker: 'cappuccino' },
          regionSlug: 'svetlogorsk',
          towns: [],
          oblastHref: '/ceny/cappuccino',
          items: [
            { ...venue, href: '/zavedeniya/cheap', slug: 'cheap', name: 'Дешёвое', priceLabel: '180 ₽' },
            { ...venue, href: '/zavedeniya/bochka-pab', slug: 'bochka-pab', name: 'Бочка', priceLabel: '220 ₽' },
          ],
        },
      },
      global: {
        components: { Sticker },
        stubs: {
          PageHeader: { template: '<header><h1>{{ h1 }}</h1></header>', props: ['h1'] },
          VenueCard: { props: ['name'], template: '<a class="card"><span>{{ name }}</span><slot /></a>' },
        },
      },
    })
    expect(wrapper.text()).toContain('Капучино в Светлогорске')
    const rows = wrapper.findAll('li')
    expect(rows[0]?.text()).toContain('Дешёвое')
    expect(rows[0]?.classes()).not.toContain('current')
    expect(rows[0]?.text()).not.toContain('Это заведение')
    expect(rows[1]?.classes()).toContain('current')
    expect(rows[1]?.text()).toContain('Бочка')
    expect(rows[1]?.text()).toContain('Это заведение')
  })
})
