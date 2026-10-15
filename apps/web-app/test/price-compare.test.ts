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
  formatPriceDate,
  indexablePriceLocs,
  inPlace,
  isPriceIndexable,
  ofTown,
  onePricePerVenue,
  placesLabel,
  placesOutOf,
  PRICE_CATEGORY_ICONS,
  PRICE_ITEM_ICONS,
  PRICE_ITEM_IMAGES,
  PRICE_STICKER_WIDTH,
  priceBlockSummary,
  priceCompareLead,
  priceItemIcon,
  priceItemImage,
  priceItemSticker,
  priceListingMeta,
  safePriceImage,
  sharedPriceSource,
} from '../shared/price-compare'
import { collectionDocument } from '../shared/seo'
import { toPublicVenueModules } from '../shared/venue-modules'

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
    expect(compare(220, [])).toEqual({ band: null, position: null, line: 'пока единственная цена в Светлогорске', scaleLabel: '' })
    expect(compare(220, [peer('a', 180)])).toEqual({
      band: null,
      position: null,
      line: 'в Светлогорске 180–220 ₽ (2 места)',
      scaleLabel: '',
    })
    expect(compare(180, [peer('a', 180)]).line).toBe('в Светлогорске 180 ₽ (2 места)')
    const ranked = compare(300, [peer('a', 100), peer('b', 150)])
    expect(ranked.band).toBe('expensive')
    expect(ranked.position).not.toBeNull()
    expect(ranked.line).toBe('дороже, чем в 2 из 3 мест Светлогорска')
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
    expect(compare(90, twenty).line).toBe('дешевле, чем в 20 из 21 места Светлогорска')
    const twentyOne = Array.from({ length: 21 }, (_, index) => peer(`q${index}`, 200))
    expect(compare(100, twentyOne).line).toBe('дешевле, чем в 21 из 22 мест Светлогорска')
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
    expect(only.line).toBe('пока единственная цена в Зеленоградске')
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
    expect(pair.line).toBe('в регионе 180–250 ₽ (2 места)')
    expect(pair.scaleLabel).toBe('')
  })

  it('places a price against the regional median and counts dearer venues', () => {
    const peers = [100, 120, 200, 210, 220, 230, 240, 250, 400].map((price, index) => peer(`v${index}`, price))
    const result = compare(180, peers)
    expect(result.band).toBe('cheap')
    expect(result.position).toBe(23)
    expect(result.line).toBe('дешевле, чем в 7 из 10 мест Светлогорска')
    expect(result.scaleLabel).toBe('Дешевле медианы по Светлогорску')
  })

  it('calls the expensive end of a large sample a top price in that town', () => {
    const peers = [100, 110, 120, 130, 140, 150, 160].map((price, index) => peer(`v${index}`, price))
    const top = compare(400, peers)
    expect(top.line).toBe('топ-3 по цене в Светлогорске')
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
    expect(unknown.line).toBe('топ-3 по цене в регионе')
    expect(unknown.scaleLabel).toBe('Дороже медианы по региону')
  })

  it('does not call three venues a top-3', () => {
    const result = compare(300, [peer('a', 100), peer('b', 150)])
    expect(result.band).toBe('expensive')
    expect(result.line).toBe('дороже, чем в 2 из 3 мест Светлогорска')
  })

  it('says the price matches the others when every venue charges the same', () => {
    const result = compare(200, [peer('a', 200), peer('b', 200), peer('c', 200), peer('d', 200)])
    expect(result.band).toBe('medium')
    expect(result.position).toBe(50)
    expect(result.line).toBe('как в других местах Светлогорска')
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
    expect(result.line).toBe('дешевле, чем в 3 из 4 мест Светлогорска')
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
    expect(priceBlockSummary(['cheap', 'cheap', 'expensive'], 'svetlogorsk')).toBe('Цены ниже среднего по Светлогорску')
    expect(priceBlockSummary(['expensive', 'medium'], 'svetlogorsk')).toBe('Цены выше среднего по Светлогорску')
    expect(priceBlockSummary(['medium', 'medium'], 'zelenogradsk')).toBe('Цены около среднего по Зеленоградску')
    expect(priceBlockSummary(['cheap'], 'yantarnyy')).toBe('Цены ниже среднего по Янтарному')
    expect(priceBlockSummary(['cheap'], 'mamonovo')).toBe('Цены ниже среднего по Мамоново')
    expect(priceBlockSummary(['cheap'], null)).toBe('Цены ниже среднего по региону')
    expect(priceBlockSummary(['expensive'], 'missing')).toBe('Цены выше среднего по региону')
    expect(priceBlockSummary([null, null], 'svetlogorsk')).toBeNull()
    const shared = sharedPriceSource([
      { sourceTitle: 'Меню на сайте заведения', sourceUrl: 'https://cafe.example/menu', checkedAt: '2026-03-01' },
      { sourceTitle: 'Меню на сайте заведения', sourceUrl: 'https://cafe.example/menu', checkedAt: '2026-10-12' },
    ])
    expect(shared?.title).toBe('Меню на сайте заведения')
    expect(shared?.url).toBe('https://cafe.example/menu')
    expect(shared?.when).toContain('проверено с')
    expect(shared?.when).toContain(formatPriceDate('2026-03-01'))
    expect(sharedPriceSource([
      { sourceTitle: 'Меню', sourceUrl: 'https://a.example', checkedAt: '2026-10-01' },
      { sourceTitle: 'Сообщено заведением', sourceUrl: null, checkedAt: '2026-10-01' },
    ])).toBeNull()
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
    expect(cards[0]?.comparison.line).toBe('дешевле, чем в 7 из 10 мест Светлогорска')
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
    const out = toPublicVenueModules([{ type: 'prices' }], (text) => text, cards, { regionSlug: 'svetlogorsk' })
    expect(out?.blocks[0]).toMatchObject({
      type: 'prices',
      summary: 'Цены ниже среднего по Светлогорску',
      source: { title: 'Меню на сайте заведения' },
    })
    expect(cards[0]?.comparison.scaleLabel).toBe('Дешевле медианы по Светлогорску')
    const unnamed = toPublicVenueModules([{ type: 'prices' }], (text) => text, cards)
    expect(unnamed?.blocks[0]).toMatchObject({ summary: 'Цены ниже среднего по региону' })
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
    comparison: { band: 'cheap' as const, position: 23, line: 'дешевле, чем в 7 из 10 мест Светлогорска', scaleLabel: 'Дешевле медианы по Светлогорску' },
  }

  function mountPrices(items: typeof card[], summary: string | null, source: { title: string, url: string | null, when: string } | null) {
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

  it('renders the same card layout, one shared footnote, and the conclusion', () => {
    const wrapper = mountPrices([card, { ...card, slug: 'americano', title: 'Американо', priceRub: 140, icon: 'cup', image: '/stickers/americano.webp', sticker: null }], 'Цены ниже среднего по Светлогорску', {
      title: 'Меню на сайте заведения',
      url: 'https://cafe.example/menu',
      when: '1 октября 2026 г.',
    })
    const cards = wrapper.findAll('.price-card')
    expect(cards).toHaveLength(2)
    expect(cards[0]?.attributes('href')).toBe('/ceny/cappuccino/svetlogorsk')
    expect(cards[0]?.text()).toContain('Капучино')
    expect(cards[0]?.text()).toContain('300 мл')
    expect(cards[0]?.text()).toContain('180 ₽')
    expect(cards[0]?.text()).toContain('дешевле, чем в 7 из 10 мест Светлогорска')
    expect(cards[0]?.text()).toContain('дёшево')
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
    expect(wrapper.text()).toContain('Цены ниже среднего по Светлогорску')
    const links = wrapper.findAll('.stub-link')
    expect(links).toHaveLength(1)
    expect(links[0]?.attributes('href')).toBe('https://cafe.example/menu')
    expect(wrapper.text()).toContain('Могли измениться.')
  })

  it('keeps a separate muted source when the rows do not share one', () => {
    const wrapper = mountPrices([
      card,
      { ...card, slug: 'burger', title: 'Бургер', sticker: 'burger' as const, sourceTitle: 'Сообщено заведением', sourceUrl: null, comparison: { band: null, position: null, line: 'пока единственная цена в Светлогорске', scaleLabel: '' } },
    ], null, null)
    expect(wrapper.find('.price-chip').exists()).toBe(false)
    expect(wrapper.findAll('.scale')).toHaveLength(1)
    expect(wrapper.text()).toContain('пока единственная цена в Светлогорске')
    expect(wrapper.findAll('.price-src')).toHaveLength(2)
    expect(wrapper.text()).toContain('Сообщено заведением')
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
