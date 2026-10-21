import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDatabase } from '../../database'
import { businesses, offerCodes, offers, regions, slugRedirects, venues } from '../../tables'
import {
  emptyHours,
  formatHoursLines,
  formatVenueDistance,
  HOURS_UNKNOWN,
  isSocialWebsite,
  isStale,
  nearbyFresh,
  osmElementToDraft,
  OVERPASS_QUERY_TIMEOUT_SECONDS,
  overpassQuery,
  parseOsmHours,
  pickVenueSlug,
  rankNearby,
  resolveVenuePath,
  VenueInputError,
  venueNameKey,
} from '../../venues'
import { Analytics } from '../analytics'
import { Search } from '../search'
import { Venues } from '../venues'

const FORT = { latitude: 54.656847, longitude: 20.567554 }
const DAY = 86_400_000

function description() {
  return 'Кафе у форта Дёнхофф варит кофе и кормит обедом. '.repeat(8).slice(0, 420)
}

async function wipe() {
  const db = useDatabase()
  await db.delete(offerCodes)
  await db.delete(offers)
  await db.delete(businesses)
  await db.delete(venues)
}

describe('venue policy', () => {
  it('formats metres and kilometres', () => {
    expect(formatVenueDistance(0.4)).toBe('400 м')
    expect(formatVenueDistance(1.23)).toBe('1,2 км')
    expect(formatVenueDistance(12.2)).toBe('12 км')
  })

  it('marks 180 days as stale and drops nearby after 365', () => {
    const now = new Date('2026-10-13T00:00:00.000Z')
    const fresh = new Date(now.getTime() - 10 * DAY).toISOString()
    const aging = new Date(now.getTime() - 200 * DAY).toISOString()
    const old = new Date(now.getTime() - 400 * DAY).toISOString()
    expect(isStale(fresh, now)).toBe(false)
    expect(isStale(aging, now)).toBe(true)
    expect(nearbyFresh(aging, now)).toBe(true)
    expect(nearbyFresh(old, now)).toBe(false)
    expect(nearbyFresh(null, now)).toBe(false)
    expect(isStale(null, now)).toBe(true)
  })

  it('puts one sponsored venue first and leaves the rest by distance', () => {
    const rows = [
      { id: 'near', distanceKm: 0.4, sponsored: false },
      { id: 'partner', distanceKm: 1.2, sponsored: true },
      { id: 'far-partner', distanceKm: 3, sponsored: true },
      { id: 'mid', distanceKm: 2, sponsored: false },
    ]
    expect(rankNearby(rows, { sponsoredSlot: false }).map((row) => row.id)).toEqual(['near', 'partner', 'mid', 'far-partner'])
    const ranked = rankNearby(rows, { sponsoredSlot: true })
    expect(ranked.map((row) => row.id)).toEqual(['partner', 'near', 'mid', 'far-partner'])
    expect(ranked[0]?.partner).toBe(true)
    expect(ranked[1]?.partner).toBe(false)
  })

  it('folds case, ё, quotes, and a kind word into one venue name key', () => {
    expect(venueNameKey('Кафе «Ёлка»')).toBe('елка')
    expect(venueNameKey('"ЁЛКА"')).toBe('елка')
    expect(venueNameKey('ресторан Елка')).toBe('елка')
    expect(venueNameKey('Кафе')).toBe('')
    expect(venueNameKey('Ёлки-палки')).toBe('елки палки')
  })

  it('maps OSM elements and skips a repeat id', () => {
    const draft = osmElementToDraft({
      type: 'node',
      id: 42,
      lat: FORT.latitude,
      lon: FORT.longitude,
      tags: {
        'amenity': 'cafe',
        'cuisine': 'coffee',
        'name:ru': 'Кофейня у форта',
        'opening_hours': 'Mo-Fr 09:00-18:00',
        'addr:street': 'ул. Дзержинского',
        'addr:housenumber': '1',
      },
    })
    expect(draft?.kind).toBe('coffee')
    expect(draft?.osmId).toBe('node/42')
    expect(draft?.slug).toBe('kofeynya-u-forta')
    expect(draft?.town).toBeNull()
    expect(draft?.contactEmail).toBeNull()
    const phones = '+7 4012 30-30-40; +7 4012 38-94-66; +7 911 851-68-55'
    expect(phones.length).toBeGreaterThan(40)
    expect(osmElementToDraft({
      type: 'node',
      id: 44,
      lat: FORT.latitude,
      lon: FORT.longitude,
      tags: { amenity: 'cafe', name: 'Порто', phone: phones },
    })?.phone).toBe(phones)
    expect(osmElementToDraft({
      type: 'node',
      id: 43,
      lat: FORT.latitude,
      lon: FORT.longitude,
      tags: { amenity: 'cafe', name: 'Почта', email: 'Desk@Cafe.Test' },
    })?.contactEmail).toBe('desk@cafe.test')
    expect(draft?.hours.days.find((day) => day.weekday === 'mon')?.opens).toBe('09:00')
    const vkSite = osmElementToDraft({
      type: 'node',
      id: 45,
      lat: FORT.latitude,
      lon: FORT.longitude,
      tags: { amenity: 'cafe', name: 'Лето', website: 'https://vk.com/leto' },
    })
    expect(vkSite?.website).toBeNull()
    expect(vkSite?.socials).toEqual([{ network: 'vk', url: 'https://vk.com/leto' }])
    expect(osmElementToDraft({ type: 'node', id: 1, lat: 1, lon: 1, tags: { amenity: 'cafe' } })).toBeNull()
    const query = overpassQuery({ latitude: 54.7, longitude: 20.5, radiusMeters: 800 })
    expect(query).toContain('around:800,54.7,20.5')
    expect(query).toContain(`[timeout:${OVERPASS_QUERY_TIMEOUT_SECONDS}]`)
    expect(formatHoursLines(emptyHours())).toEqual([HOURS_UNKNOWN])
    expect(formatHoursLines(parseOsmHours(''))).toEqual(['Часы уточняйте'])
    expect(formatHoursLines(parseOsmHours('Mo-Fr 09:00-18:00'))).toEqual(['пн-пт 09:00-18:00', 'сб-вс выходной'])
    expect(formatHoursLines(emptyHours('по записи'))).toEqual(['по записи'])
    expect(pickVenueSlug('Кафе', new Set(), new Set())).toBe('kafe-2')
    expect(pickVenueSlug('Кафе', new Set(), new Set(), { town: 'Светлогорск' })).toBe('kafe-svetlogorsk')
    expect(pickVenueSlug('Кафе Уют', new Set(['kafe-uyut']), new Set(), { town: 'Светлогорск', district: 'Центр' })).toBe('kafe-uyut-svetlogorsk')
    expect(pickVenueSlug('Кафе Уют', new Set(['kafe-uyut', 'kafe-uyut-svetlogorsk']), new Set(), { town: 'Светлогорск' })).toBe('kafe-uyut-svetlogorsk-2')
    expect(pickVenueSlug('Кафе Уют', new Set(['kafe-uyut', 'kafe-uyut-svetlogorsk']), new Set(), { town: 'Светлогорск', district: 'Центр' })).toBe('kafe-uyut-tsentr')
    expect(pickVenueSlug('Светлогорск', new Set(), new Set(['svetlogorsk']))).toBe('svetlogorsk-2')
    expect(resolveVenuePath(['svetlogorsk', 'kofe'], new Set(['svetlogorsk']))).toEqual({
      type: 'listing',
      regionSlug: 'svetlogorsk',
      kind: 'coffee',
    })
  })
})

describe('venue repository', () => {
  beforeEach(async () => {
    await wipe()
  })

  it('dedupes an OSM import and refuses to publish a short description', async () => {
    const draft = osmElementToDraft({
      type: 'way',
      id: 7,
      center: { lat: FORT.latitude, lon: FORT.longitude },
      tags: { amenity: 'restaurant', name: 'Столовая у вала' },
    })
    expect(draft).toBeTruthy()
    const first = await Venues.importDrafts([draft!], null)
    const second = await Venues.importDrafts([draft!], null)
    expect(first.created).toHaveLength(1)
    expect(second.created).toHaveLength(0)
    expect(second.existing).toEqual(first.created)
    const row = await Venues.byId(first.created[0]!)
    expect(row?.status).toBe('draft')
    expect(row?.osmId).toBe('way/7')
    await expect(Venues.update(row!.id, { status: 'published', description: 'Коротко' })).rejects.toBeInstanceOf(VenueInputError)
  })

  it('keeps three phone numbers that used to be cut at 40 characters', async () => {
    const phones = '+7 4012 30-30-40; +7 4012 38-94-66; +7 911 851-68-55'
    const created = await Venues.create({
      name: 'Порто на променаде',
      kind: 'restaurant',
      status: 'published',
      description: description(),
      phone: phones,
    })
    expect(created.phone).toBe(phones)
    const updated = await Venues.update(created.id, { phone: phones })
    expect(updated?.phone).toBe(phones)
  })

  it('rejects a social website and can move that link into socials in one update', async () => {
    expect(isSocialWebsite('https://vk.com/cafe')).toBe(true)
    expect(isSocialWebsite('https://www.instagram.com/cafe')).toBe(true)
    expect(isSocialWebsite('t.me/cafe')).toBe(true)
    expect(isSocialWebsite('https://ok.ru/group')).toBe(true)
    expect(isSocialWebsite('https://cafe.example')).toBe(false)
    const socialWebsite = 'В поле «Сайт» укажите только собственный сайт заведения. Ссылку на соцсеть добавьте в «Соцсети».'
    await expect(Venues.create({
      name: 'ВК как сайт',
      kind: 'cafe',
      website: 'https://vk.com/cafe',
    })).rejects.toThrow(socialWebsite)
    const created = await Venues.create({
      name: 'Собственный сайт',
      kind: 'cafe',
      website: 'https://cafe.example',
    })
    await expect(Venues.update(created.id, { website: 'https://t.me/cafe' })).rejects.toThrow(socialWebsite)
    await expect(Venues.update(created.id, { website: 'https://instagram.com/cafe' })).rejects.toThrow(socialWebsite)
    await expect(Venues.update(created.id, { website: 'https://ok.ru/group' })).rejects.toThrow(socialWebsite)
    await expect(Venues.update(created.id, { website: 'https://vk.ru/cafe' })).rejects.toThrow(socialWebsite)
    const moved = await Venues.update(created.id, {
      website: null,
      socials: [{ network: 'vk', url: 'https://vk.com/cafe' }],
    })
    expect(moved?.website).toBeNull()
    expect(moved?.socials).toEqual([{ network: 'vk', url: 'https://vk.com/cafe' }])
    await useDatabase().update(venues).set({ website: 'https://vk.com/legacy' }).where(eq(venues.id, created.id))
    const kept = await Venues.update(created.id, { phone: '+7 4012 00-00-00' })
    expect(kept?.website).toBe('https://vk.com/legacy')
    expect(kept?.socials).toEqual([{ network: 'vk', url: 'https://vk.com/cafe' }])
  })

  it('orders nearby food venues and hides rows older than a year', async () => {
    const now = new Date('2026-10-13T12:00:00.000Z')
    const fresh = new Date(now.getTime() - 10 * DAY).toISOString()
    const aging = new Date(now.getTime() - 200 * DAY).toISOString()
    const old = new Date(now.getTime() - 400 * DAY).toISOString()
    const near = await Venues.create({
      name: 'Ближняя кофейня у форта Дёнхофф',
      kind: 'coffee',
      latitude: FORT.latitude,
      longitude: FORT.longitude,
      status: 'published',
      description: description(),
      lastVerifiedAt: fresh,
    })
    const partner = await Venues.create({
      name: 'Партнёрская столовая у форта',
      kind: 'restaurant',
      latitude: FORT.latitude + 0.01,
      longitude: FORT.longitude,
      status: 'published',
      description: description(),
      lastVerifiedAt: aging,
    })
    await Venues.create({
      name: 'Дальняя пекарня за городом',
      kind: 'bakery',
      latitude: FORT.latitude + 0.08,
      longitude: FORT.longitude,
      status: 'published',
      description: description(),
      lastVerifiedAt: fresh,
    })
    await Venues.create({
      name: 'Старая закусочная без проверки',
      kind: 'fastfood',
      latitude: FORT.latitude,
      longitude: FORT.longitude,
      status: 'published',
      description: description(),
      lastVerifiedAt: old,
    })
    await Venues.create({
      name: 'Черновик кафе',
      kind: 'cafe',
      latitude: FORT.latitude,
      longitude: FORT.longitude,
      status: 'draft',
      lastVerifiedAt: fresh,
    })
    const [business] = await useDatabase().insert(businesses).values({ slug: 'stolovaya', name: 'Столовая' }).returning()
    await useDatabase().insert(offers).values({
      businessId: business!.id,
      venueId: partner.id,
      title: 'Обед',
      terms: 'Скидка по коду',
      status: 'active',
    })
    const found = await Venues.nearby([FORT], now)
    const ids = found.map((row) => row.id)
    expect(ids).toContain(near.id)
    expect(ids).toContain(partner.id)
    expect(ids).toHaveLength(2)
    expect(found[0]?.id).toBe(near.id)
    expect(found.find((row) => row.id === partner.id)?.sponsored).toBe(true)
    const ranked = rankNearby(found, { sponsoredSlot: true })
    expect(ranked[0]?.id).toBe(partner.id)
    expect(ranked[0]?.partner).toBe(true)
    expect(formatVenueDistance(ranked[0]!.distanceKm)).toMatch(/км|м/)
    const stale = await Venues.list({ stale: true })
    expect(stale.map((row) => row.id)).toContain(partner.id)
    const freshRows = await Venues.list({ stale: false, status: 'published' })
    expect(freshRows.map((row) => row.id)).toContain(near.id)
    expect(freshRows.map((row) => row.id)).not.toContain(partner.id)
  })

  it('records a venue pageview and a nearby impression', async () => {
    const venue = await Venues.create({
      name: 'Бар у ворот',
      slug: 'bar-u-vorot',
      kind: 'bar',
      status: 'draft',
    })
    const subject = await Analytics.resolvePath('/zavedeniya/bar-u-vorot')
    expect(subject.venueId).toBe(venue.id)
    await Analytics.insertHits([{
      visitorKey: 'visitor',
      visitorMode: 'daily',
      sessionKey: 'session',
      consented: false,
      isBot: false,
      eventType: 'impression',
      path: '/fort-11-denhoff',
      venueId: venue.id,
      channel: 'direct',
    }, {
      visitorKey: 'visitor',
      visitorMode: 'daily',
      sessionKey: 'session',
      consented: false,
      isBot: false,
      eventType: 'pageview',
      path: '/zavedeniya/bar-u-vorot',
      venueId: venue.id,
      channel: 'direct',
    }])
    const stats = await Analytics.venueStats(venue.id, new Date('2020-01-01'), new Date('2030-01-01'))
    expect(stats).toEqual([{ venueId: venue.id, impressions: 1, pageviews: 1 }])
  })

  it('suffixes a clashing slug with the town, then a number, and names the unique field', async () => {
    const first = await Venues.create({ name: 'Кафе Уют', kind: 'cafe', osmId: 'node/1' })
    expect(first.slug).toBe('kafe-uyut')
    const town = await Venues.create({
      name: 'Кафе Уют',
      kind: 'cafe',
      osmId: 'node/2',
      locality: { town: 'Светлогорск', district: 'Центр' },
    })
    expect(town.slug).toBe('kafe-uyut-svetlogorsk')
    const numbered = await Venues.create({
      name: 'Кафе Уют',
      kind: 'cafe',
      osmId: 'node/3',
      locality: { town: 'Светлогорск' },
    })
    expect(numbered.slug).toBe('kafe-uyut-svetlogorsk-2')
    const district = await Venues.create({
      name: 'Кафе Уют',
      kind: 'cafe',
      osmId: 'node/4',
      locality: { town: 'Светлогорск', district: 'Центр' },
    })
    expect(district.slug).toBe('kafe-uyut-tsentr')
    await expect(Venues.create({
      name: 'Другое кафе',
      slug: 'kafe-uyut',
      kind: 'cafe',
      osmId: 'node/5',
    })).rejects.toThrow('Такой адрес уже есть')
    await expect(Venues.create({
      name: 'Другое кафе',
      slug: 'drugoe-kafe',
      kind: 'cafe',
      osmId: 'node/1',
    })).rejects.toThrow('Такой osmId уже есть')
    await expect(Venues.update(numbered.id, { slug: first.slug })).rejects.toThrow('Такой адрес уже есть')
    await expect(Venues.update(numbered.id, { osmId: 'node/1' })).rejects.toThrow('Такой osmId уже есть')
    const region = await Venues.regionBySlug('svetlogorsk')
    expect(region?.slug).toBe('svetlogorsk')
    const plain = await Venues.create({ name: 'Булочная на дюнах', kind: 'bakery' })
    const regional = await Venues.create({
      name: 'Булочная на дюнах',
      kind: 'bakery',
      regionId: region?.id,
    })
    expect(plain.slug).toBe('bulochnaya-na-dyunah')
    expect(regional.slug).toBe('bulochnaya-na-dyunah-svetlogorsk')
    let osmMessage = ''
    try {
      await Venues.create({ name: 'Ещё кафе', slug: 'esche-kafe', kind: 'cafe', osmId: 'node/2' })
    } catch (error) {
      osmMessage = error instanceof VenueInputError ? error.message : ''
    }
    expect(osmMessage).toBe('Такой osmId уже есть')
  })

  it('imports two OSM cafes with the same name under town slugs', async () => {
    const svetlogorsk = osmElementToDraft({
      type: 'node',
      id: 11,
      lat: FORT.latitude,
      lon: FORT.longitude,
      tags: { 'amenity': 'cafe', 'name': 'Уют', 'addr:city': 'Светлогорск' },
    })
    const zelenogradsk = osmElementToDraft({
      type: 'node',
      id: 12,
      lat: FORT.latitude,
      lon: FORT.longitude,
      tags: { 'amenity': 'cafe', 'name': 'Уют', 'addr:city': 'Зеленоградск', 'addr:suburb': 'Центр' },
    })
    expect(svetlogorsk?.town).toBe('Светлогорск')
    expect(zelenogradsk?.district).toBe('Центр')
    const imported = await Venues.importDrafts([svetlogorsk!, zelenogradsk!], null)
    expect(imported.created).toHaveLength(2)
    const rows = await Promise.all(imported.created.map((id) => Venues.byId(id)))
    expect(rows.map((row) => row?.slug).sort()).toEqual(['uyut', 'uyut-zelenogradsk'])
  })

  it('deletes a draft or an archived venue and keeps a published one', async () => {
    const draft = await Venues.create({ name: 'Черновик булочной', kind: 'bakery' })
    expect((await Venues.remove(draft.id))?.action).toBe('deleted')
    expect(await Venues.byId(draft.id)).toBeNull()
    const archived = await Venues.create({ name: 'Архивная булочная', kind: 'bakery', status: 'archived' })
    expect((await Venues.remove(archived.id))?.action).toBe('deleted')
    expect(await Venues.bySlug(archived.slug)).toBeNull()
    const [gone] = await useDatabase().select().from(slugRedirects).where(eq(slugRedirects.fromPath, `/zavedeniya/${archived.slug}`))
    expect(gone?.statusCode).toBe(410)
    const published = await Venues.create({
      name: 'Живая булочная у набережной',
      kind: 'bakery',
      status: 'published',
      description: description(),
    })
    await expect(Venues.remove(published.id)).rejects.toThrow('Удалить можно только черновик или архив')
    expect(await Venues.byId(published.id)).toBeTruthy()
    const closed = await Venues.create({ name: 'Закрытая булочная', kind: 'bakery', status: 'closed' })
    await expect(Venues.remove(closed.id)).rejects.toThrow('Удалить можно только черновик или архив')
  })

  it('keeps existing dish names and prices when the showcase columns are filled', async () => {
    const text = description()
    const bochka = await Venues.create({
      name: 'Бочка Паб',
      slug: 'bochka-pab-svetlogorsk',
      kind: 'bar',
      status: 'published',
      description: text,
      modules: [{
        type: 'dishes',
        note: 'Цены из меню на сайте паба.',
        items: [
          { name: 'Дегустационный набор пива', priceRub: 700, note: 'Удобно, чтобы сравнить свои и привозные сорта' },
          { name: 'Смёрреброд с копчёной форелью', priceRub: 540 },
        ],
      }],
    })
    const skovorodka = await Venues.create({
      name: 'Сковородка',
      slug: 'skovorodka',
      kind: 'cafe',
      status: 'published',
      description: text,
      signatureDishes: [{ name: 'Пицца Маргарита', note: 'Собственная выпечка', priceRub: 650 }],
    })
    const sqlText = readFileSync(resolve(__dirname, '../../../migrations/0029_dish_showcase.sql'), 'utf8')
    const update = sqlText.split('--> statement-breakpoint')[0] ?? ''
    await useDatabase().$client.query(update)
    const once = await Venues.byId(bochka.id)
    const firstId = ((once?.modules as Array<{ items?: Array<{ id?: string }> }>)[0]?.items?.[0]?.id)
    await useDatabase().$client.query(update)
    const again = await Venues.byId(bochka.id)
    const modules = again?.modules as Array<{ type: string, note?: string, items: Array<Record<string, unknown>> }>
    const showcase = modules.find((module) => module.type === 'dishes')
    const items = showcase?.items ?? []
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      name: 'Дегустационный набор пива',
      priceRub: 700,
      note: 'Удобно, чтобы сравнить свои и привозные сорта',
      description: 'Удобно, чтобы сравнить свои и привозные сорта',
    })
    expect(String(items[0]?.id)).toMatch(/^[0-9a-f-]{36}$/)
    expect(items[0]?.id).toBe(firstId)
    expect(String(items[0]?.updatedAt)).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(items[1]).toMatchObject({ name: 'Смёрреброд с копчёной форелью', priceRub: 540 })
    expect(items[1]?.description).toBeUndefined()
    const pantry = await Venues.byId(skovorodka.id)
    expect(pantry?.signatureDishes).toEqual([{ name: 'Пицца Маргарита', note: 'Собственная выпечка', priceRub: 650 }])
    expect(pantry?.modules).toEqual([])
    const paths = (await Search.query('смёрреброд')).map((row) => row.path)
    expect(paths).toContain('/zavedeniya/bochka-pab-svetlogorsk')
  })

  it('keeps a stored price band across an ordinary edit', async () => {
    const venue = await Venues.create({ name: 'Полоса цен', slug: 'price-band-cafe', kind: 'cafe', status: 'draft' })
    const computedAt = '2026-10-15T12:00:00.000Z'
    await Venues.setPriceBand(venue.id, { level: 'low', basis: 4, computedAt })
    const stored = await Venues.byId(venue.id)
    expect(stored?.priceBand).toBe('low')
    expect(stored?.priceBandBasis).toBe(4)
    expect(stored?.priceBandComputedAt && new Date(stored.priceBandComputedAt).toISOString()).toBe(computedAt)
    const edited = await Venues.update(venue.id, { name: 'Полоса цен два' })
    expect(edited?.priceBand).toBe('low')
    expect(edited?.priceBandBasis).toBe(4)
    const town = await Venues.inRegion(null)
    expect(town.map((row) => row.id)).toContain(venue.id)
    await useDatabase().delete(venues).where(eq(venues.id, venue.id))
  })

  it('pages every venue once and matches a name with ё folded', async () => {
    await Venues.create({ name: 'Гамма', slug: 'page-gamma', kind: 'bar', status: 'draft' })
    await Venues.create({ name: 'Альфа', slug: 'page-alpha', kind: 'cafe', status: 'published', description: description() })
    await Venues.create({ name: 'Бета', slug: 'page-beta', kind: 'cafe', status: 'closed' })
    await Venues.create({ name: 'Кафе «Ёлка»', slug: 'page-yolka', kind: 'cafe', status: 'archived' })
    const first = await Venues.listPage({ page: 1, pageSize: 2 })
    const second = await Venues.listPage({ page: 2, pageSize: 2 })
    const third = await Venues.listPage({ page: 3, pageSize: 2 })
    expect(first.total).toBe(4)
    expect(second.total).toBe(4)
    expect(third).toMatchObject({ total: 4, items: [], page: 3, pageSize: 2 })
    const slugs = [...first.items, ...second.items].map((row) => row.slug)
    expect(slugs).toEqual(['page-alpha', 'page-beta', 'page-gamma', 'page-yolka'])
    expect(new Set(slugs).size).toBe(4)
    const cafes = await Venues.listPage({ kind: 'cafe', page: 1, pageSize: 50 })
    expect(cafes.total).toBe(3)
    expect(cafes.items.map((row) => row.slug)).toEqual(['page-alpha', 'page-beta', 'page-yolka'])
    const found = await Venues.listPage({ query: 'елка' })
    expect(found.total).toBe(1)
    expect(found.items[0]?.slug).toBe('page-yolka')
    const bySlug = await Venues.listPage({ query: 'page-gamma' })
    expect(bySlug.items.map((row) => row.slug)).toEqual(['page-gamma'])
  })

  it('pages a nearby filter without dropping or repeating a row', async () => {
    await Venues.create({ name: 'Рядом А', slug: 'near-a', kind: 'cafe', latitude: FORT.latitude, longitude: FORT.longitude, status: 'draft' })
    await Venues.create({ name: 'Рядом Б', slug: 'near-b', kind: 'cafe', latitude: FORT.latitude + 0.001, longitude: FORT.longitude, status: 'draft' })
    await Venues.create({ name: 'Далеко', slug: 'near-far', kind: 'cafe', latitude: FORT.latitude + 0.05, longitude: FORT.longitude, status: 'draft' })
    const filter = { near: { latitude: FORT.latitude, longitude: FORT.longitude, radiusKm: 1 }, pageSize: 1 }
    const first = await Venues.listPage({ ...filter, page: 1 })
    const second = await Venues.listPage({ ...filter, page: 2 })
    const third = await Venues.listPage({ ...filter, page: 3 })
    expect(first.total).toBe(2)
    expect([...first.items, ...second.items].map((row) => row.slug)).toEqual(['near-a', 'near-b'])
    expect(third.items).toEqual([])
    expect(first.items[0]?.distanceKm).toBe(0)
  })

  it('finds a duplicate by a name variant and by a nearby point, including archived', async () => {
    const db = useDatabase()
    await db.delete(regions).where(eq(regions.slug, 'dup-town'))
    const [town] = await db.insert(regions).values({ slug: 'dup-town', title: 'Город дублей' }).returning()
    try {
      const tree = await Venues.create({
        name: 'Кафе «Ёлка»',
        slug: 'dup-yolka',
        kind: 'cafe',
        status: 'archived',
        latitude: FORT.latitude,
        longitude: FORT.longitude,
        regionId: town!.id,
      })
      const neighbor = await Venues.create({
        name: 'Соседняя пекарня',
        slug: 'dup-neighbor',
        kind: 'bakery',
        status: 'closed',
        latitude: FORT.latitude + 0.001,
        longitude: FORT.longitude,
        regionId: town!.id,
      })
      await Venues.create({
        name: 'Дальняя Ёлка',
        slug: 'dup-far',
        kind: 'restaurant',
        status: 'draft',
        latitude: FORT.latitude + 0.05,
        longitude: FORT.longitude,
      })
      const byName = await Venues.findDuplicates({ name: '"ЁЛКА"' })
      expect(byName.map((row) => row.slug)).toEqual(['dup-yolka'])
      expect(byName[0]).toMatchObject({
        status: 'archived',
        kind: 'cafe',
        matched: ['name'],
        distanceM: null,
        region: { slug: 'dup-town', title: 'Город дублей' },
      })
      const byPoint = await Venues.findDuplicates({ latitude: FORT.latitude, longitude: FORT.longitude })
      expect(byPoint.map((row) => row.slug)).toEqual(['dup-yolka', 'dup-neighbor'])
      expect(byPoint[0]?.matched).toEqual(['coordinates'])
      expect(byPoint[1]?.distanceM).toBeGreaterThan(100)
      expect(byPoint[1]?.distanceM).toBeLessThanOrEqual(150)
      const both = await Venues.findDuplicates({
        name: 'ресторан Елка',
        latitude: FORT.latitude,
        longitude: FORT.longitude,
      })
      expect(both.find((row) => row.id === tree.id)?.matched).toEqual(['name', 'coordinates'])
      expect(both.some((row) => row.id === neighbor.id && row.matched.includes('coordinates'))).toBe(true)
      const inTown = await Venues.findDuplicates({ name: 'Ёлка', regionId: town!.id })
      expect(inTown.map((row) => row.slug)).toEqual(['dup-yolka'])
    } finally {
      await db.delete(venues).where(eq(venues.regionId, town!.id))
      await db.delete(regions).where(eq(regions.id, town!.id))
    }
  })
})
