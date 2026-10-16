import type { StoredPageModule } from '../types'
import { eq } from 'drizzle-orm'
import { useDatabase } from '../database'
import { Editor } from '../repository/content'
import { Prices } from '../repository/prices'
import { Schedules } from '../repository/schedules'
import { Venues } from '../repository/venues'
import { media, placeMedia, venueMedia } from '../tables'
import { WEEKDAYS } from '../venues'
import { PRICE_CATALOG } from './price-catalog'

/**
 * Idempotent UI fixtures. The text is a label for layout checks.
 * It is not a place article and it is not loaded on boot.
 */
export const FIXTURE_SLUGS = {
  town: 'fixture-town',
  townPlain: 'fixture-plain',
  placeHub: 'fixture-town',
  placeStop: 'fixture-stop',
  cafePhoto: 'fixture-cafe-photo',
  cafePlain: 'fixture-cafe-plain',
  cafePeer: 'fixture-cafe-peer',
  cafeNoCoords: 'fixture-cafe-nocoords',
  collection: 'fixture-modules',
} as const

const MENU_URL = 'https://fixture.k39.test/menu'
const HOURS_URL = 'https://fixture.k39.test/hours'
const INSTAGRAM = 'https://instagram.com/k39_fixture'

function fixtureProse(label: string) {
  const sentence = `${label}. Проверка вёрстки, не статья о месте. `
  let text = ''
  while (text.length < 320) {
    text += sentence
  }
  return text.slice(0, 480).trim()
}

function weekHours() {
  return {
    note: null,
    days: WEEKDAYS.map((weekday) => ({
      weekday,
      closed: false,
      opens: '10:00',
      closes: '20:00',
    })),
  }
}

function scheduleRules() {
  return {
    mode: 'hours',
    seasons: [{ week: [{ days: [1, 2, 3, 4, 5], opens: '10:00', closes: '20:00', breaks: [] }] }],
    closures: [],
    holidays: 'as-usual',
    exceptions: [],
    occurrences: [],
    needsCheck: false,
  }
}

function venueModules(): unknown[] {
  return [
    { type: 'text', variant: 'lead', text: 'Фикстура: текст о зале.' },
    { type: 'dishes', items: [{ name: 'Сырники', description: 'Фикстура блюда' }] },
    { type: 'audience', items: [{ who: 'Компания', text: 'Фикстура аудитории' }] },
    { type: 'practical', items: [{ key: 'wifi', label: 'Wi-Fi', value: 'Есть' }] },
    { type: 'best-time', text: 'Фикстура: будни до обеда.' },
    { type: 'how-to-get', text: 'Фикстура: пешком от остановки.' },
    { type: 'tips', items: ['Фикстура: взять сдачу.'] },
    { type: 'prices' },
    { type: 'faq', items: [{ question: 'Это фикстура?', answer: 'Да, для проверки страницы.' }] },
  ]
}

function collectionModules(): StoredPageModule[] {
  return [
    { type: 'text', variant: 'lead', text: 'Фикстура подборки.' },
    {
      type: 'month-stats',
      title: 'Фикстура месяца',
      tiles: [{ label: 'Дни', value: '30' }, { label: 'Точки', value: '1' }],
      rows: [],
    },
    { type: 'picker', questions: ['interest', 'company'] },
    { type: 'ideas', title: 'Идеи', items: [{ title: 'Идея', text: 'Фикстура идеи.', tags: ['eda'] }] },
    { type: 'plans', title: 'План', items: [{ title: 'День', text: 'Фикстура плана.', tags: ['peshkom'] }] },
    { type: 'places', title: 'Места' },
    { type: 'months', title: 'Месяцы' },
  ]
}

async function ensureCover(owner: { placeId?: string, venueId?: string }, alt: string) {
  const db = useDatabase()
  if (owner.placeId) {
    const [linked] = await db.select({ id: placeMedia.id }).from(placeMedia).where(eq(placeMedia.placeId, owner.placeId)).limit(1)
    if (linked) {
      return
    }
  }
  if (owner.venueId) {
    const [linked] = await db.select({ id: venueMedia.id }).from(venueMedia).where(eq(venueMedia.venueId, owner.venueId)).limit(1)
    if (linked) {
      return
    }
  }
  const [photo] = await db.insert(media).values({
    filename: 'fixture.webp',
    mime: 'image/webp',
    bytes: 1,
    width: 800,
    height: 500,
    alt,
    variants: [{ format: 'webp', width: 800, height: 500, bytes: 1, file: '800.webp' }],
  }).returning()
  if (!photo) {
    return
  }
  if (owner.placeId) {
    await db.insert(placeMedia).values({ placeId: owner.placeId, mediaId: photo.id, isCover: true, sortOrder: 0 })
  }
  if (owner.venueId) {
    await db.insert(venueMedia).values({ venueId: owner.venueId, mediaId: photo.id, isCover: true, sortOrder: 0, origin: 'own' })
  }
}

async function ensureVenue(input: {
  slug: string
  name: string
  regionId: string
  latitude: number | null
  longitude: number | null
  socials?: Array<{ network: string, url: string }>
  modules?: unknown[]
  hours?: ReturnType<typeof weekHours>
}) {
  const description = fixtureProse(input.name)
  const existing = await Venues.bySlug(input.slug)
  const write = {
    slug: input.slug,
    name: input.name,
    kind: 'cafe' as const,
    status: 'published' as const,
    description,
    regionId: input.regionId,
    latitude: input.latitude,
    longitude: input.longitude,
    address: input.latitude == null ? null : 'Фикстура, улица Проверки, 1',
    phone: '+7 401 200-00-00',
    socials: input.socials ?? [],
    modules: input.modules ?? [],
    hours: input.hours,
    noindex: true,
    menuUrl: MENU_URL,
    sources: [{ title: 'Меню фикстуры', url: MENU_URL }],
  }
  const row = existing
    ? await Venues.update(existing.id, write)
    : await Venues.create(write)
  if (!row) {
    throw new Error(`Fixture venue missing: ${input.slug}`)
  }
  return row
}

export async function applyFixtures(now = new Date()) {
  for (const item of PRICE_CATALOG) {
    await Prices.upsertItem(item)
  }
  const town = await Editor.upsertRegion({
    slug: FIXTURE_SLUGS.town,
    title: 'Фикстура: город',
    shortTitle: 'Фикстура',
    description: 'Город для проверки карточек.',
    latitude: 54.72,
    longitude: 20.5,
  })
  const plain = await Editor.upsertRegion({
    slug: FIXTURE_SLUGS.townPlain,
    title: 'Фикстура: город без фото',
    shortTitle: 'Без фото',
    description: 'Город без обложки.',
    latitude: 54.95,
    longitude: 20.47,
  })
  const hub = await Editor.savePlace({
    slug: FIXTURE_SLUGS.placeHub,
    title: 'Фикстура: город',
    summary: 'Обложка города для списка заведений.',
    body: 'Фикстура места. Не статья.',
    status: 'unknown',
    publicationStatus: 'published',
    noindex: true,
    regionId: town.id,
    latitude: 54.72,
    longitude: 20.5,
    sources: [],
  })
  await Editor.savePlace({
    slug: FIXTURE_SLUGS.placeStop,
    title: 'Фикстура: остановка',
    summary: 'Карточка в модульной подборке.',
    body: 'Фикстура места. Не статья.',
    status: 'unknown',
    publicationStatus: 'published',
    noindex: true,
    regionId: town.id,
    latitude: 54.721,
    longitude: 20.501,
    sources: [],
  })
  await ensureCover({ placeId: hub.id }, 'Фикстура города')

  const photo = await ensureVenue({
    slug: FIXTURE_SLUGS.cafePhoto,
    name: 'Фикстура: кафе с фото',
    regionId: town.id,
    latitude: 54.721,
    longitude: 20.502,
    socials: [{ network: 'instagram', url: INSTAGRAM }],
    modules: venueModules(),
    hours: weekHours(),
  })
  const quiet = await ensureVenue({
    slug: FIXTURE_SLUGS.cafePlain,
    name: 'Фикстура: кафе без фото',
    regionId: town.id,
    latitude: 54.722,
    longitude: 20.503,
    hours: weekHours(),
  })
  const peer = await ensureVenue({
    slug: FIXTURE_SLUGS.cafePeer,
    name: 'Фикстура: кафе для сравнения',
    regionId: town.id,
    latitude: 54.723,
    longitude: 20.504,
  })
  const nowhere = await ensureVenue({
    slug: FIXTURE_SLUGS.cafeNoCoords,
    name: 'Фикстура: кафе без координат',
    regionId: plain.id,
    latitude: null,
    longitude: null,
  })
  await ensureCover({ venueId: photo.id }, 'Фикстура кафе')

  const day = now.toISOString().slice(0, 10)
  const priced = [
    { venue: photo, cappuccino: 180, americano: 160, latte: 200, band: 'low' as const },
    { venue: quiet, cappuccino: 220, americano: 200, latte: 240, band: 'mid' as const },
    { venue: peer, cappuccino: 280, americano: 260, latte: 300, band: 'high' as const },
  ]
  for (const row of priced) {
    await Prices.setForVenue(row.venue.id, [
      { item: 'cappuccino', priceRub: row.cappuccino, checkedAt: day, sourceKind: 'official', sourceTitle: 'Меню фикстуры', sourceUrl: MENU_URL },
      { item: 'americano', priceRub: row.americano, checkedAt: day, sourceKind: 'official', sourceTitle: 'Меню фикстуры', sourceUrl: MENU_URL },
      { item: 'latte', priceRub: row.latte, checkedAt: day, sourceKind: 'official', sourceTitle: 'Меню фикстуры', sourceUrl: MENU_URL },
    ])
    await Venues.setPriceBand(row.venue.id, { level: row.band, basis: 3, computedAt: now.toISOString() })
  }

  const rules = scheduleRules()
  for (const venue of [photo, quiet]) {
    await Schedules.save({
      entityType: 'venue',
      entityId: venue.id,
      rules,
      sourceUrl: HOURS_URL,
      verifiedAt: day,
    }, [])
  }

  await Editor.saveCollection({
    slug: FIXTURE_SLUGS.collection,
    title: 'Фикстура: модули',
    summary: 'Подборка для проверки модульной страницы.',
    body: 'Фикстура подборки.',
    publicationStatus: 'published',
    noindex: true,
    items: [{ placeSlug: FIXTURE_SLUGS.placeStop }, { placeSlug: FIXTURE_SLUGS.placeHub }],
    modules: collectionModules(),
  })

  return {
    slugs: FIXTURE_SLUGS,
    catalog: PRICE_CATALOG.length,
    venues: [photo.slug, quiet.slug, peer.slug, nowhere.slug],
  }
}
