import { isSocialWebsite } from '@k39/database'
import { isSocialHost } from '@k39/types/social-hosts'
import { parseVkCommunityId, vkCommunityIdProblem, vkMenuMatchesSocial, vkSocialLinks } from '@k39/types/vk-community'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import CheaperPage from '../app/components/CheaperPage.vue'
import PriceListing from '../app/components/PriceListing.vue'
import Sticker from '../app/components/Sticker.vue'
import VenueModules from '../app/components/VenueModules.vue'
import { classifySourceUrl } from '../shared/facts'
import { TABLER_ICONS } from '../shared/icons'
import {
  buildPublicPrices,
  byTown,
  cheaperCityMeta,
  classifyMenuUrl,
  compareVenuePrice,
  formatTownRange,
  groupCheaperSamples,
  indexablePriceLocs,
  inPlace,
  isMenuUrl,
  isPackagedJuice,
  isPriceIndexable,
  knownPortion,
  ofTown,
  onePricePerVenue,
  placesLabel,
  placesOutOf,
  PRICE_BAND_MIN,
  PRICE_CATEGORY_ICONS,
  PRICE_ITEM_ICONS,
  PRICE_ITEM_IMAGES,
  PRICE_STICKER_WIDTH,
  priceBadgeFromBand,
  priceBandFromBands,
  priceBlockSummary,
  priceCardTap,
  priceCompareLead,
  priceFreshnessText,
  priceItemIcon,
  priceItemImage,
  priceItemSticker,
  priceListingMeta,
  priceListNode,
  priceSampleStats,
  resolveMenuPrice,
  safePriceImage,
  sharedPriceSource,
  showsPriceSample,
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
    place: 'Светлогорска и окрестностей',
    where: 'в Светлогорске и окрестностях',
    by: 'Светлогорску и окрестностям',
    peers,
  })
}

describe('price comparison', () => {
  it('keeps a known area slug custom display name in grammatical cases and aggregate accessibility copy', () => {
    const region = { slug: 'zelenogradsk', title: 'Историческое название', shortTitle: 'Побережье' }
    expect(ofTown(region)).toBe('территории «Побережье»')
    expect(byTown(region)).toBe('территории «Побережье»')
    expect(inPlace(region)).toBe('на территории «Побережье»')
    expect(priceCompareLead(region)).toBe('Сравниваем с другими заведениями территории «Побережье»')
    expect(priceBlockSummary(['cheap', 'cheap', 'medium'], region)).toEqual({ text: 'ниже среднего', label: 'Цены ниже среднего по территории «Побережье»' })
    expect(priceBadgeFromBand('high', region)).toEqual({ text: 'выше среднего', label: 'Цены выше среднего по территории «Побережье»' })
  })

  it('names the only price, a two-venue range, and a rank from three venues', () => {
    expect(compare(220, [])).toMatchObject({
      band: null,
      position: null,
      line: 'Пока единственная цена',
      scaleLabel: '',
      town: { medianRub: 220, minRub: 220, maxRub: 220, places: 1, where: 'В Светлогорске и окрестностях' },
    })
    expect(compare(220, [peer('a', 180)])).toMatchObject({
      band: null,
      position: null,
      line: 'Пока мало данных для сравнения',
      scaleLabel: '',
      town: { medianRub: 200, minRub: 180, maxRub: 220, places: 2, where: 'В Светлогорске и окрестностях' },
    })
    expect(compare(180, [peer('a', 180)]).town).toMatchObject({ minRub: 180, maxRub: 180, places: 2 })
    const ranked = compare(300, [peer('a', 100), peer('b', 150)])
    expect(ranked.band).toBe('expensive')
    expect(ranked.position).not.toBeNull()
    expect(ranked.line).toBe('Дороже, чем в 2 из 3 мест Светлогорска и окрестностей')
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
    expect(compare(90, twenty).line).toBe('Дешевле, чем в 20 из 21 места Светлогорска и окрестностей')
    const twentyOne = Array.from({ length: 21 }, (_, index) => peer(`q${index}`, 200))
    expect(compare(100, twentyOne).line).toBe('Дешевле, чем в 21 из 22 мест Светлогорска и окрестностей')
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
      expect(ofTown(slug)).toBe(`${genitive} и окрестностей`)
      expect(byTown(slug)).toBe(`${dative} и окрестностям`)
      expect(inPlace(slug)).toBe(`${prepositional} и окрестностях`)
    }
    expect(inPlace('missing')).toBe('на этой территории')
    expect(inPlace(null)).toBe('на этой территории')
    expect(byTown('missing')).toBe('этой территории')
    expect(byTown(null)).toBe('этой территории')
    expect(priceCompareLead('svetlogorsk')).toBe('Сравниваем с другими заведениями Светлогорска и окрестностей')
    expect(priceCompareLead('kaliningrad')).toBe('Сравниваем с другими заведениями Калининграда и окрестностей')
    expect(priceCompareLead(null)).toBe('Сравниваем с другими заведениями этой территории')
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
    expect(pair.town.where).toBe('На этой территории')
    expect(pair.scaleLabel).toBe('')
  })

  it('places a price against the regional median and counts dearer venues', () => {
    const peers = [100, 120, 200, 210, 220, 230, 240, 250, 400].map((price, index) => peer(`v${index}`, price))
    const result = compare(180, peers)
    expect(result.band).toBe('cheap')
    expect(result.position).toBe(23)
    expect(result.line).toBe('Дешевле, чем в 7 из 10 мест Светлогорска и окрестностей')
    expect(result.town).toEqual({ medianRub: 215, minRub: 100, maxRub: 400, places: 10, where: 'В Светлогорске и окрестностях' })
    expect(result.scaleLabel).toBe('Дешевле медианы по Светлогорску и окрестностям')
  })

  it('calls the expensive end of a large sample a top price in that town', () => {
    const peers = [100, 110, 120, 130, 140, 150, 160].map((price, index) => peer(`v${index}`, price))
    const top = compare(400, peers)
    expect(top.line).toBe('Топ-3 по цене в Светлогорске и окрестностях')
    expect(top.band).toBe('expensive')
    expect(top.scaleLabel).toBe('Дороже медианы по Светлогорску и окрестностям')
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
    expect(unknown.line).toBe('Топ-3 по цене на этой территории')
    expect(unknown.scaleLabel).toBe('Дороже медианы по этой территории')
  })

  it('does not call three venues a top-3', () => {
    const result = compare(300, [peer('a', 100), peer('b', 150)])
    expect(result.band).toBe('expensive')
    expect(result.line).toBe('Дороже, чем в 2 из 3 мест Светлогорска и окрестностей')
  })

  it('says the price matches the others when every venue charges the same', () => {
    const result = compare(200, [peer('a', 200), peer('b', 200), peer('c', 200), peer('d', 200)])
    expect(result.band).toBe('medium')
    expect(result.position).toBe(50)
    expect(result.line).toBe('Как в других местах Светлогорска и окрестностей')
    expect(result.scaleLabel).toBe('Около медианы по Светлогорску и окрестностям')
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
    expect(result.line).toBe('Дешевле, чем в 3 из 4 мест Светлогорска и окрестностей')
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
    expect(ofTown('svetlogorsk')).toBe('Светлогорска и окрестностей')
    expect(ofTown('missing')).toBe('этой территории')
    expect(ofTown(null)).toBe('этой территории')
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
    expect(PRICE_BAND_MIN).toBe(3)
    expect(priceBlockSummary(['cheap', 'cheap', 'expensive'], 'svetlogorsk')).toEqual({ text: 'ниже среднего', label: 'Цены ниже среднего по Светлогорску и окрестностям' })
    expect(priceBlockSummary(['expensive', 'expensive', 'cheap'], 'svetlogorsk')).toEqual({ text: 'выше среднего', label: 'Цены выше среднего по Светлогорску и окрестностям' })
    expect(priceBlockSummary(['medium', 'medium', 'medium'], 'zelenogradsk')).toEqual({ text: 'около среднего', label: 'Цены около среднего по Зеленоградску и окрестностям' })
    expect(priceBlockSummary(['cheap', 'cheap'], 'svetlogorsk')).toBeNull()
    expect(priceBlockSummary(['cheap'], 'yantarnyy')).toBeNull()
    expect(priceBlockSummary(['expensive'], 'missing')).toBeNull()
    expect(priceBlockSummary([null, null], 'svetlogorsk')).toBeNull()
    expect(priceBandFromBands(['cheap', 'cheap', 'expensive'])).toEqual({ level: 'low', basis: 3 })
    expect(priceBandFromBands(['expensive', 'medium', 'medium'])).toEqual({ level: 'high', basis: 3 })
    expect(priceBandFromBands(['cheap', 'expensive', 'medium'])).toEqual({ level: 'mid', basis: 3 })
    expect(priceBandFromBands(['expensive', 'medium'])).toEqual({ level: null, basis: 2 })
    expect(priceBandFromBands(['medium'])).toEqual({ level: null, basis: 1 })
    expect(priceBandFromBands([null, null])).toEqual({ level: null, basis: 0 })
    expect(priceBadgeFromBand('low', 'yantarnyy')).toEqual({ text: 'ниже среднего', label: 'Цены ниже среднего по Янтарному и окрестностям' })
    expect(priceBadgeFromBand('low', 'mamonovo')).toEqual({ text: 'ниже среднего', label: 'Цены ниже среднего по Мамоново и окрестностям' })
    expect(priceBadgeFromBand('high', 'missing')).toEqual({ text: 'выше среднего', label: 'Цены выше среднего по этой территории' })
    expect(priceBadgeFromBand('low', null)).toEqual({ text: 'ниже среднего', label: 'Цены ниже среднего по этой территории' })
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
    expect(formatTownRange({ medianRub: 300, minRub: 185, maxRub: 420, places: 5, where: 'В Светлогорске и окрестностях' })).toBe('185–420 ₽')
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
    expect(thin.h1).toBe('Капучино в Светлогорске и окрестностях')
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
    expect(cards[0]?.comparison.line).toBe('Дешевле, чем в 7 из 10 мест Светлогорска и окрестностей')
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
      summary: { text: 'ниже среднего', label: 'Цены ниже среднего по Светлогорску и окрестностям' },
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
    expect(cards[0]?.comparison.scaleLabel).toBe('Дешевле медианы по Светлогорску и окрестностям')
    const unnamed = toPublicVenueModules([{ type: 'prices' }], (text) => text, cards, { priceBand: 'low' })
    expect(unnamed?.blocks[0]).toMatchObject({ summary: { text: 'ниже среднего', label: 'Цены ниже среднего по этой территории' } })
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
      line: 'Дешевле, чем в 7 из 10 мест Светлогорска и окрестностей',
      scaleLabel: 'Дешевле медианы по Светлогорску и окрестностям',
      town: { medianRub: 215, minRub: 100, maxRub: 400, places: 10, where: 'В Светлогорске и окрестностях' },
    },
  }

  function mountPrices(items: typeof card[], summary: { text: string, label: string } | null, source: { title: string, url: string | null, date: string } | null) {
    return mount(VenueModules, {
      props: {
        blocks: [{
          type: 'prices',
          id: 'tseny',
          title: 'Ориентиры цен',
          lead: 'Сравниваем с другими заведениями Светлогорска и окрестностей',
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
    const wrapper = mountPrices([card, { ...card, slug: 'americano', title: 'Американо', priceRub: 140, icon: 'cup', image: '/stickers/americano.webp', sticker: null, variant: 'объём не указан' }], { text: 'ниже среднего', label: 'Цены ниже среднего по Светлогорску и окрестностям' }, {
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
    expect(detail.text()).toContain('Дешевле, чем в 7 из 10 мест Светлогорска и окрестностей')
    expect(detail.text()).toContain('В Светлогорске и окрестностях')
    expect(detail.text()).toContain('Медиана: 215 ₽')
    expect(detail.text()).toContain('Диапазон: 100–400 ₽')
    expect(detail.text()).toContain('Мест: 10')
    expect(detail.text()).toContain('Порция: 300 мл')
    expect(detail.text()).not.toContain('дёшево')
    expect(wrapper.html()).toContain('Дешевле, чем в 7 из 10 мест Светлогорска и окрестностей')
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
    expect(wrapper.text()).toContain('Сравниваем с другими заведениями Светлогорска и окрестностей')
    expect(cards[0]?.find('.scale').attributes('aria-label')).toBe('Дешевле медианы по Светлогорску и окрестностям')
    const badge = wrapper.get('.price-badge')
    expect(badge.text()).toBe('ниже среднего')
    expect(badge.attributes('title')).toBe('Цены ниже среднего по Светлогорску и окрестностям')
    expect(badge.attributes('aria-label')).toBe('Цены ниже среднего по Светлогорску и окрестностям')
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
      town: { medianRub: 180, minRub: 180, maxRub: 180, places: 1, where: 'В Светлогорске и окрестностях' },
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
      h1: 'Капучино в Светлогорске и окрестностях',
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
    expect(wrapper.text()).toContain('Капучино в Светлогорске и окрестностях')
    const rows = wrapper.findAll('li')
    expect(rows[0]?.text()).toContain('Дешёвое')
    expect(rows[0]?.classes()).not.toContain('current')
    expect(rows[0]?.text()).not.toContain('Это заведение')
    expect(rows[1]?.classes()).toContain('current')
    expect(rows[1]?.text()).toContain('Бочка')
    expect(rows[1]?.text()).toContain('Это заведение')
  })

  it('prints the median, the range, one menu link, and the check dates', () => {
    const doc = collectionDocument({
      path: '/ceny/cappuccino/svetlogorsk',
      h1: 'Капучино в Светлогорске и окрестностях',
      summary: 'Капучино в Светлогорске: свежие цены.',
      seoTitle: 'Капучино в Светлогорске: цены',
      crumbName: 'список',
      parent: { name: 'Светлогорск', href: '/gde-deshevle/svetlogorsk' },
      items: [],
      kind: 'CollectionPage',
    })
    const venue = {
      kindLabel: 'Кафе',
      media: null,
      schedule: null,
      stale: false,
      meta: '',
      phone: null,
      variant: '300 мл',
    }
    const wrapper = mount(PriceListing, {
      props: {
        page: {
          doc,
          item: { slug: 'cappuccino', title: 'Капучино', image: null, sticker: 'cappuccino' },
          regionSlug: 'svetlogorsk',
          towns: [],
          oblastHref: '/ceny/cappuccino',
          stats: {
            medianRub: 220,
            minRub: 180,
            maxRub: 260,
            places: 3,
            freshness: 'Проверено с 2 октября 2026 г. по 15 октября 2026 г.',
            source: { title: 'Меню на сайте заведения', url: 'https://cafe.example/menu', date: '2026-10-15' },
          },
          items: [
            { ...venue, href: '/zavedeniya/a', slug: 'a', name: 'Первое', priceLabel: '180 ₽' },
            { ...venue, href: '/zavedeniya/b', slug: 'b', name: 'Второе', priceLabel: '220 ₽' },
            { ...venue, href: '/zavedeniya/c', slug: 'c', name: 'Третье', priceLabel: '260 ₽' },
          ],
        },
      },
      global: {
        components: { Sticker },
        stubs: {
          PageHeader: { template: '<header><h1>{{ h1 }}</h1></header>', props: ['h1'] },
          VenueCard: { props: ['name'], template: '<a class="card"><span>{{ name }}</span><slot /></a>' },
          UiLink: { props: ['href'], template: '<a class="menu" :href="href"><slot /></a>' },
        },
      },
    })
    expect(wrapper.text()).toContain('Медиана')
    expect(wrapper.text()).toContain('220 ₽')
    expect(wrapper.text()).toContain('180–260 ₽')
    expect(wrapper.text()).toContain('Проверено с 2 октября 2026 г. по 15 октября 2026 г.')
    const menus = wrapper.findAll('a.menu')
    expect(menus).toHaveLength(1)
    expect(menus[0]?.attributes('href')).toBe('https://cafe.example/menu')
    expect(wrapper.text()).toContain('Цены могли измениться.')
    expect(wrapper.text()).not.toContain('—')
  })
})

describe('where cheaper samples', () => {
  const column = {
    venueId: 'v',
    item: 'cappuccino',
    variant: '300 мл',
    priceRub: 200,
    checkedAt: '2026-10-01',
    sourceKind: 'official',
    sourceTitle: 'Меню на сайте заведения',
    sourceUrl: 'https://cafe.example/menu',
  }

  it('keeps an official menu price and drops juice from a carton, a gap, and a social url', () => {
    expect(showsPriceSample(2)).toBe(false)
    expect(showsPriceSample(3)).toBe(true)
    expect(isPackagedJuice('orange-juice', 'из пакета')).toBe(true)
    expect(isPackagedJuice('orange-juice', 'бутылка, 0,2 л')).toBe(true)
    expect(isPackagedJuice('orange-juice', 'свежевыжатый, 250 мл')).toBe(false)
    expect(isPackagedJuice('beer', 'бутылка, 0,33 л')).toBe(false)
    expect(isMenuUrl('https://cafe.example/menu.pdf')).toBe(true)
    expect(isMenuUrl('https://vk.com/cafe')).toBe(false)
    expect(isMenuUrl('https://yandex.ru/maps/org/1')).toBe(false)
    const kept = resolveMenuPrice(column, null, '2025-10-01')
    expect(kept?.comparable).toBe(true)
    expect(kept?.row.priceRub).toBe(200)
    const fact = resolveMenuPrice(column, {
      confidence: 'stated',
      sourceKind: 'official',
      sourceUrl: 'https://cafe.example/menu',
      sourceTitle: 'Меню на сайте заведения',
      checkedAt: '2026-10-12',
      value: { itemSlug: 'cappuccino', variant: '300 мл', priceRub: 240 },
    }, '2025-10-01')
    expect(fact?.row.priceRub).toBe(240)
    expect(fact?.row.checkedAt).toBe('2026-10-12')
    expect(resolveMenuPrice(column, {
      confidence: 'gap',
      sourceKind: 'none',
      sourceUrl: null,
      sourceTitle: null,
      checkedAt: null,
      value: { itemSlug: 'cappuccino', variant: '300 мл', priceRub: 240 },
    }, '2025-10-01')).toBeNull()
    expect(resolveMenuPrice({ ...column, item: 'orange-juice', variant: 'из пакета' }, null, '2025-10-01')).toBeNull()
    expect(resolveMenuPrice(column, {
      confidence: 'stated',
      sourceKind: 'official_social',
      sourceUrl: 'https://vk.com/cafe',
      sourceTitle: 'Пост',
      checkedAt: '2026-10-01',
      value: { priceRub: 210, variant: '300 мл' },
    }, '2025-10-01')).toBeNull()
    const owner = resolveMenuPrice({ ...column, sourceKind: 'owner', sourceUrl: null }, null, '2025-10-01')
    expect(owner?.comparable).toBe(false)
    expect(owner?.row.priceRub).toBe(200)
    expect(resolveMenuPrice({ ...column, checkedAt: '2024-01-01' }, null, '2025-10-01')).toBeNull()
    expect(priceFreshnessText(['2026-10-02', '2026-10-15', '2026-10-02'])).toContain('по')
    expect(priceSampleStats([180, 220, 260])).toMatchObject({ medianRub: 220, minRub: 180, maxRub: 260 })
  })

  it('shows a city from three venues and indexes it from five', () => {
    const point = (regionSlug: string, itemSlug: string, venueId: string, priceRub: number) => ({
      regionSlug,
      itemSlug,
      itemTitle: itemSlug,
      itemSort: 1,
      itemImage: null,
      venueId,
      priceRub,
      checkedAt: '2026-10-01',
      variant: '300 мл',
      sourceTitle: 'Меню',
      sourceUrl: 'https://cafe.example/menu',
    })
    const svetlogorsk = [
      ...['a', 'b', 'c', 'd', 'e'].map((id, index) => point('svetlogorsk', 'cappuccino', id, 180 + index)),
      ...['f', 'g', 'h'].map((id, index) => point('svetlogorsk', 'borscht', id, 300 + index)),
      point('svetlogorsk', 'tea', 'i', 100),
      point('svetlogorsk', 'tea', 'j', 120),
    ]
    const zelenogradsk = ['k', 'l', 'm', 'n'].map((id, index) => point('zelenogradsk', 'cappuccino', id, 200 + index))
    const yantarny = [point('yantarnyy', 'latte', 'p', 220), point('yantarnyy', 'latte', 'q', 240)]
    const grouped = groupCheaperSamples([...svetlogorsk, ...zelenogradsk, ...yantarny])
    const svet = grouped.cities.find((city) => city.slug === 'svetlogorsk')
    expect(svet?.items.map((item) => item.slug).sort()).toEqual(['borscht', 'cappuccino'])
    expect(svet?.venueCount).toBe(10)
    expect(isPriceIndexable(svet?.venueCount ?? 0)).toBe(true)
    const zelen = grouped.cities.find((city) => city.slug === 'zelenogradsk')
    expect(zelen?.items).toHaveLength(1)
    expect(zelen?.items[0]?.count).toBe(4)
    expect(isPriceIndexable(zelen?.venueCount ?? 0)).toBe(false)
    expect(grouped.cities.some((city) => city.slug === 'yantarnyy')).toBe(false)
    expect(cheaperCityMeta({ regionSlug: 'zelenogradsk', regionName: 'Зеленоградск', venueCount: 4 }).noindex).toBe(true)
    expect(cheaperCityMeta({ regionSlug: 'svetlogorsk', regionName: 'Светлогорск', venueCount: 10 }).noindex).toBe(false)
    expect(cheaperCityMeta({ regionSlug: 'svetlogorsk', regionName: 'Светлогорск', venueCount: 10 }).h1).toBe('Где дешевле в Светлогорске и окрестностях')
    expect(cheaperCityMeta({ regionSlug: 'svetlogorsk', regionName: 'Светлогорск', venueCount: 10 }).h1).not.toContain('—')
    const page = mount(CheaperPage, {
      props: {
        page: {
          doc: collectionDocument({
            path: '/gde-deshevle/svetlogorsk',
            h1: 'Где дешевле в Светлогорске и окрестностях',
            summary: 'Где дешевле в Светлогорске. Позиции из официальных меню.',
            seoTitle: 'Где дешевле в Светлогорске и окрестностях',
            crumbName: 'список',
            parent: { name: 'Где дешевле', href: '/gde-deshevle' },
            items: [],
            kind: 'CollectionPage',
          }),
          regionSlug: 'svetlogorsk',
          cities: [{ slug: 'svetlogorsk', title: 'Светлогорск', href: '/gde-deshevle/svetlogorsk', places: '6 мест', venueCount: 6 }],
          items: [{
            slug: 'cappuccino',
            title: 'Капучино',
            href: '/ceny/cappuccino/svetlogorsk',
            image: null,
            sticker: 'cappuccino',
            medianRub: 250,
            minRub: 180,
            maxRub: 320,
            places: '6 мест',
          }],
        },
      },
      global: {
        components: { Sticker },
        stubs: { PageHeader: { template: '<header><h1>{{ h1 }}</h1><p>{{ lede }}</p></header>', props: ['h1', 'lede'] } },
      },
    })
    expect(page.text()).toContain('Капучино')
    expect(page.text()).toContain('250 ₽')
    expect(page.text()).toContain('180–320 ₽, 6 мест')
    expect(page.get('a[href="/ceny/cappuccino/svetlogorsk"]').exists()).toBe(true)
    expect(page.text()).not.toContain('—')
  })
})

describe('menu url classifier', () => {
  it('accepts a venue site and official document hosts', () => {
    const accepted = [
      ['https://cafe.example/menu.pdf', 'menu'],
      ['http://cafe.example/menu', 'menu'],
      ['https://www.cafe.example/menu.pdf', 'menu'],
      ['https://DRIVE.google.com/file/d/abc/view', 'document'],
      ['https://drive.google.com/uc?id=abc', 'document'],
      ['https://docs.google.com/document/d/abc/edit', 'document'],
      ['https://docs.google.com/spreadsheets/d/abc', 'document'],
      ['https://disk.yandex.ru/i/abc', 'document'],
      ['https://disk.yandex.com/d/abc', 'document'],
      ['https://www.disk.yandex.kz/i/abc', 'document'],
      ['https://disk.yandex.by/i/abc', 'document'],
      ['https://yadi.sk/i/abc', 'document'],
      ['https://www.yadi.sk/d/abc', 'document'],
    ] as const
    for (const [url, kind] of accepted) {
      expect(classifyMenuUrl(url), url).toBe(kind)
      expect(isMenuUrl(url), url).toBe(true)
    }
  })

  it('rejects maps, aggregators, social networks, and other company services', () => {
    const rejected = [
      ['https://maps.google.com/?q=cafe', 'map'],
      ['https://www.google.com/maps/place/Brikas', 'map'],
      ['https://google.ru/maps/search/cafe', 'map'],
      ['https://maps.google.co.uk/maps?q=cafe', 'map'],
      ['https://maps.app.goo.gl/abc123', 'map'],
      ['https://goo.gl/maps/abc123', 'map'],
      ['https://goo.gl/not-maps', 'map'],
      ['https://yandex.ru/maps/org/1', 'map'],
      ['https://maps.yandex.ru/213/kaliningrad', 'map'],
      ['https://yandex.com/maps/org/1', 'map'],
      ['https://ya.ru/maps/org/1', 'map'],
      ['https://2gis.ru/kaliningrad/firm/1', 'map'],
      ['https://2gis.com/firm/1', 'map'],
      ['https://www.openstreetmap.org/node/1', 'map'],
      ['https://osm.org/node/1', 'map'],
      ['https://eda.yandex.ru/restaurant/cafe', 'aggregator'],
      ['https://eda.yandex.by/restaurant/cafe', 'aggregator'],
      ['https://yandex.ru/eda/r/cafe', 'aggregator'],
      ['https://www.delivery-club.ru/srv/cafe', 'aggregator'],
      ['https://kaliningrad.tomesto.ru/places/cafe', 'aggregator'],
      ['https://vk.com/cafe', 'social'],
      ['https://m.vk.com/cafe', 'social'],
      ['https://vk.ru/othergroup', 'social'],
      ['https://m.vk.ru/othergroup', 'social'],
      ['https://vk.com/market-123', 'social'],
      ['https://instagram.com/cafe', 'social'],
      ['https://t.me/cafe', 'social'],
      ['https://wa.me/79990001122', 'social'],
      ['https://x.com/cafe', 'social'],
      ['https://twitter.com/cafe', 'social'],
      ['https://www.google.com/search?q=menu', 'service'],
      ['https://market.yandex.ru/product/1', 'service'],
      ['https://music.yandex.ru/album/1', 'service'],
      ['notaurl', 'invalid'],
      ['ftp://cafe.example/menu.pdf', 'invalid'],
      ['', 'invalid'],
    ] as const
    for (const [url, kind] of rejected) {
      expect(classifyMenuUrl(url), url).toBe(kind)
      expect(isMenuUrl(url), url).toBe(false)
    }
    expect(isMenuUrl(null)).toBe(false)
    expect(isMenuUrl(undefined)).toBe(false)
  })
})

describe('social hosts', () => {
  it('uses one list for menu class, source kind, and website', () => {
    const urls = [
      'https://vk.com/cafe',
      'https://www.vk.ru/cafe',
      'https://m.vk.ru/othergroup',
      'https://t.me/cafe',
      'https://telegram.me/cafe',
      'https://telegram.org/cafe',
      'https://ok.ru/group',
      'https://instagram.com/cafe',
      'https://facebook.com/cafe',
      'https://fb.com/cafe',
      'https://fb.me/cafe',
      'https://threads.net/cafe',
      'https://youtube.com/cafe',
      'https://youtu.be/abc',
      'https://dzen.ru/cafe',
      'https://tiktok.com/@cafe',
      'https://whatsapp.com/send',
      'https://wa.me/79990001122',
      'https://x.com/cafe',
      'https://twitter.com/cafe',
    ]
    for (const url of urls) {
      expect(isSocialHost(new URL(url).hostname), url).toBe(true)
      expect(isSocialWebsite(url), url).toBe(true)
      expect(classifyMenuUrl(url), url).toBe('social')
      expect(classifySourceUrl(url), url).toBe('official_social')
      expect(isMenuUrl(url), url).toBe(false)
    }
    expect(isSocialHost('cafe.example')).toBe(false)
    expect(classifySourceUrl('https://cafe.example/menu')).toBe('official')
  })
})

describe('vk menu rule', () => {
  const column = {
    venueId: 'v',
    item: 'cappuccino',
    variant: '300 мл',
    priceRub: 200,
    checkedAt: '2026-10-01',
    sourceKind: 'official',
    sourceTitle: 'Меню во ВКонтакте',
    sourceUrl: 'https://vk.com/cafe',
  }
  const cutoff = '2025-10-01'
  const own = [{ url: 'https://vk.com/cafe' }]
  const vkFact = {
    confidence: 'stated',
    sourceKind: 'official_social',
    sourceUrl: 'https://vk.com/market-10',
    sourceTitle: 'Меню во ВКонтакте',
    checkedAt: '2026-10-01',
    value: { priceRub: 210, variant: '300 мл' },
  }

  it('counts a vk price only when its community matches socials and the venue has no website', () => {
    expect(vkMenuMatchesSocial('https://vk.com/cafe', own)).toBe(true)
    expect(vkMenuMatchesSocial('https://m.vk.com/Cafe', own)).toBe(true)
    expect(vkMenuMatchesSocial('https://vk.com/club10', [{ url: 'https://vk.com/public10' }])).toBe(true)
    expect(vkMenuMatchesSocial('https://vk.com/wall-10_3', [{ url: 'https://vk.com/club10' }])).toBe(true)
    expect(vkMenuMatchesSocial('https://vk.com/album-10_4', [{ url: 'https://vk.com/market-10' }])).toBe(true)
    expect(vkMenuMatchesSocial('https://vk.com/album-10', [{ url: 'https://vk.ru/club10' }])).toBe(true)
    expect(vkMenuMatchesSocial('https://vk.com/club10', [{ url: 'https://vk.com/cafe?w=wall-10_1' }])).toBe(true)
    expect(vkMenuMatchesSocial('https://vk.com/cafe?w=wall-999_5', own)).toBe(false)
    expect(vkMenuMatchesSocial('https://vk.com/cafe?z=photo-999_1', own)).toBe(false)
    expect(vkMenuMatchesSocial('https://vk.com/cafe?w=wall-999_5', [{ url: 'https://vk.com/club999' }])).toBe(true)
    expect(vkMenuMatchesSocial('https://vk.com/cafe?z=photo-999_1', [{ url: 'https://vk.com/public999' }])).toBe(true)
    expect(vkMenuMatchesSocial('https://vk.com/event10', [{ url: 'https://vk.com/club10' }])).toBe(true)
    expect(vkMenuMatchesSocial('https://vk.com/photo-10_2', [{ url: 'https://vk.com/club10' }])).toBe(true)
    expect(vkMenuMatchesSocial('https://vk.com/doc-10_3', [{ url: 'https://vk.com/club10' }])).toBe(true)
    expect(vkMenuMatchesSocial('https://vk.com/topic-10_4', [{ url: 'https://vk.com/club10' }])).toBe(true)
    expect(vkMenuMatchesSocial('https://vk.com/video-10_5', [{ url: 'https://vk.com/club10' }])).toBe(true)
    expect(vkMenuMatchesSocial('https://vk.com/feed', [{ url: 'https://vk.com/feed' }])).toBe(false)
    expect(vkMenuMatchesSocial('https://vk.com/away.php', own)).toBe(false)
    expect(vkMenuMatchesSocial('https://vk.com/search', own)).toBe(false)
    expect(vkMenuMatchesSocial('https://vk.com/im', own)).toBe(false)
    expect(vkMenuMatchesSocial('https://vk.com/feed?w=wall-10_1', own)).toBe(false)
    expect(vkMenuMatchesSocial('https://vk.com/feed?w=wall-10_1', [{ url: 'https://vk.com/club10' }])).toBe(true)
    expect(vkMenuMatchesSocial('https://vk.com/id5', [{ url: 'https://vk.com/wall5_9' }])).toBe(true)
    expect(vkMenuMatchesSocial('https://vk.com/cafe', [{ url: 'https://vk.com/club10' }])).toBe(false)
    expect(vkMenuMatchesSocial('https://vk.com/id5', [{ url: 'https://vk.com/club5' }])).toBe(false)
    expect(vkMenuMatchesSocial('https://vk.com/other', own)).toBe(false)
    expect(vkMenuMatchesSocial('https://instagram.com/cafe', own)).toBe(false)

    const fromFact = resolveMenuPrice(column, vkFact, cutoff, { website: null, socials: [{ url: 'https://vk.com/club10' }] })
    expect(fromFact?.comparable).toBe(true)
    expect(fromFact?.row.priceRub).toBe(210)
    expect(fromFact?.row.sourceKind).toBe('official_social')
    expect(resolveMenuPrice(column, null, cutoff, { website: '', socials: own })?.comparable).toBe(true)
    expect(resolveMenuPrice(column, null, cutoff, { website: '   ', socials: own })?.comparable).toBe(true)
    expect(resolveMenuPrice({ ...column, sourceUrl: 'https://m.vk.com/cafe' }, null, cutoff, { website: null, socials: own })?.comparable).toBe(true)
    expect(resolveMenuPrice(column, vkFact, cutoff, { website: 'https://cafe.example', socials: own })).toBeNull()
    expect(resolveMenuPrice(column, null, cutoff, { website: 'https://vk.com/cafe', socials: own })).toBeNull()
    expect(resolveMenuPrice({
      ...column,
      sourceUrl: 'https://vk.ru/othergroup',
    }, null, cutoff, { website: 'https://cafe.example', socials: [{ url: 'https://vk.ru/othergroup' }] })).toBeNull()
    expect(resolveMenuPrice({
      ...column,
      sourceUrl: 'https://vk.ru/cafe',
    }, null, cutoff, { website: null, socials: [{ url: 'https://vk.ru/cafe' }] })?.comparable).toBe(true)
    expect(resolveMenuPrice(column, null, cutoff, { website: null, socials: [] })).toBeNull()
    expect(resolveMenuPrice(column, null, cutoff)).toBeNull()
    expect(resolveMenuPrice(column, {
      ...vkFact,
      sourceUrl: 'https://instagram.com/cafe',
    }, cutoff, { website: null, socials: own })).toBeNull()
    expect(resolveMenuPrice({ ...column, sourceUrl: 'https://drive.google.com/file/d/abc/view' }, null, cutoff, { website: 'https://cafe.example', socials: own })?.comparable).toBe(true)
    expect(resolveMenuPrice({ ...column, sourceUrl: 'https://yandex.ru/maps/org/1' }, null, cutoff, { website: null, socials: own })).toBeNull()
    const owner = resolveMenuPrice({ ...column, sourceKind: 'owner', sourceUrl: 'https://vk.com/cafe' }, null, cutoff, { website: null, socials: own })
    expect(owner?.comparable).toBe(false)
    expect(owner?.row.priceRub).toBe(200)
  })

  it('matches a numeric owner id to a screen-name social once the community id is declared', () => {
    const socials = [{ url: 'https://vk.com/lugowen_gastro' }]
    const album = 'https://vk.com/album-236300695_311487837'
    const sources = [
      album,
      'https://vk.com/market-236300695',
      'https://vk.com/wall-236300695_12',
      'https://vk.com/lugowen_gastro?z=photo-236300695_457239017',
      'https://vk.com/lugowen_gastro?w=wall-236300695_40',
      'https://vk.com/club236300695',
      'https://vk.com/public236300695',
    ]
    for (const url of sources) {
      expect(vkMenuMatchesSocial(url, socials)).toBe(false)
      expect(vkMenuMatchesSocial(url, socials, 236300695)).toBe(true)
    }
    expect(vkMenuMatchesSocial('https://vk.com/market?w=product-236300695_5', socials, 236300695)).toBe(true)
    expect(vkMenuMatchesSocial('https://vk.com/market?w=product-236300695_5', socials)).toBe(false)
    expect(vkMenuMatchesSocial('https://vk.com/product-236300695_5', [{ url: 'https://vk.com/club236300695' }])).toBe(true)
    expect(vkMenuMatchesSocial('https://vk.com/lugowen_gastro?w=product-71522139_5', socials, 236300695)).toBe(false)
    expect(vkMenuMatchesSocial(album, socials, 71522139)).toBe(false)
    expect(vkMenuMatchesSocial('https://vk.com/lugowen_gastro?z=photo-71522139_1', socials, 236300695)).toBe(false)
    expect(vkMenuMatchesSocial(album, [], 236300695)).toBe(false)
    expect(vkMenuMatchesSocial(album, [{ url: 'https://t.me/lugowen' }], 236300695)).toBe(false)

    const row = { ...column, sourceUrl: album }
    expect(resolveMenuPrice(row, null, cutoff, { website: null, socials })).toBeNull()
    expect(resolveMenuPrice(row, null, cutoff, { website: null, socials, vkCommunityId: 236300695 })?.comparable).toBe(true)
    expect(resolveMenuPrice(row, null, cutoff, { website: null, socials, vkCommunityId: 71522139 })).toBeNull()
    expect(resolveMenuPrice(row, null, cutoff, { website: 'https://lugowen.example', socials, vkCommunityId: 236300695 })).toBeNull()
  })

  it('takes the community id from a club, public, or event social without a declared id', () => {
    for (const prefix of ['club', 'public', 'event']) {
      const socials = [{ url: `https://vk.com/${prefix}71522139` }]
      expect(vkSocialLinks(socials).communityIds).toEqual([71522139])
      expect(vkMenuMatchesSocial('https://vk.com/market-71522139', socials)).toBe(true)
      expect(resolveMenuPrice({ ...column, sourceUrl: 'https://vk.com/album-71522139_1' }, null, cutoff, { website: null, socials })?.comparable).toBe(true)
    }
    expect(vkSocialLinks([{ url: 'https://vk.com/clubletokafe39' }])).toEqual({ links: 1, names: ['clubletokafe39'], communityIds: [] })
    expect(vkSocialLinks([{ url: 'https://instagram.com/cafe' }]).links).toBe(0)
  })

  it('validates a declared community id against the stored VK links', () => {
    expect(parseVkCommunityId(236300695)).toBe(236300695)
    expect(parseVkCommunityId(' 236300695 ')).toBe(236300695)
    expect(parseVkCommunityId('')).toBeNull()
    expect(parseVkCommunityId(null)).toBeNull()
    for (const bad of [0, -5, 1.5, 'club10', '-10', '12a', Number.MAX_SAFE_INTEGER + 1, Number.NaN]) {
      expect(parseVkCommunityId(bad)).toBe('invalid')
    }
    expect(vkCommunityIdProblem(null, [])).toBeNull()
    expect(vkCommunityIdProblem(10, [])).toBe('no_vk_link')
    expect(vkCommunityIdProblem(10, [{ url: 'https://t.me/cafe' }])).toBe('no_vk_link')
    expect(vkCommunityIdProblem(10, [{ url: 'https://vk.com/cafe' }])).toBeNull()
    expect(vkCommunityIdProblem(10, [{ url: 'https://vk.com/club10' }])).toBeNull()
    expect(vkCommunityIdProblem(11, [{ url: 'https://vk.com/club10' }])).toBe('mismatch')
    expect(vkCommunityIdProblem(11, [{ url: 'https://vk.com/club10' }, { url: 'https://vk.com/cafe' }])).toBeNull()
  })
})

describe('price band from a Drive menu', () => {
  it('assigns a band when three fresh official prices come from a Drive PDF', () => {
    const drive = 'https://drive.google.com/file/d/menu-pdf/view'
    const items = [
      { item: 'cappuccino', title: 'Капучино', category: 'coffee' },
      { item: 'borscht', title: 'Борщ', category: 'soup' },
      { item: 'caesar', title: 'Цезарь', category: 'salad' },
    ]
    const resolved = items.map((row) => resolveMenuPrice({
      venueId: 'drive-cafe',
      item: row.item,
      variant: '300 мл',
      priceRub: 200,
      checkedAt: '2026-10-01',
      sourceKind: 'official',
      sourceTitle: 'Меню PDF на Google Drive',
      sourceUrl: drive,
    }, null, '2025-10-01'))
    expect(resolved.every((row) => row?.comparable)).toBe(true)
    const cards = buildPublicPrices({
      venueId: 'drive-cafe',
      venueSlug: 'drive-cafe',
      regionId: REGION,
      regionSlug: 'svetlogorsk',
      rows: resolved.map((row, index) => ({
        item: items[index]!.item,
        title: items[index]!.title,
        category: items[index]!.category,
        variant: row!.row.variant,
        priceRub: row!.row.priceRub,
        checkedAt: row!.row.checkedAt,
        sourceTitle: row!.row.sourceTitle,
        sourceUrl: row!.row.sourceUrl,
      })),
      peersByItem: {
        cappuccino: [250, 320].map((priceRub, index) => peer(`cap-${index}`, priceRub)),
        borscht: [250, 320].map((priceRub, index) => peer(`bor-${index}`, priceRub)),
        caesar: [250, 320].map((priceRub, index) => peer(`cae-${index}`, priceRub)),
      },
    })
    expect(cards.map((card) => card.comparison.band)).toEqual(['cheap', 'cheap', 'cheap'])
    expect(cards.every((card) => card.sourceUrl === drive)).toBe(true)
    expect(priceBandFromBands(cards.map((card) => card.comparison.band))).toEqual({ level: 'low', basis: 3 })
  })
})
