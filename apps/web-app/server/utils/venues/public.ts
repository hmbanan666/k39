import process from 'node:process'
import {
  CLOSED_NOTE,
  cuisineLabels,
  db,
  descriptionLength,
  FOOD_KINDS,
  formatAvgCheck,
  formatVenueDistance,
  formatWalk,
  HOURS_UNKNOWN,
  hoursAreSet,
  isStale,
  KIND_HEADING,
  kindHeading,
  kindLabel,
  LISTING_INTRO_MIN,
  listingPath,
  NEARBY_LIMIT,
  NEARBY_RADIUS_KM,
  normalizeHours,
  priceMarks,
  rankNearby,
  resolveVenuePath,
  STALE_NOTE,
} from '@k39/database'
import { EAT_NOW_PATH, eatNowPath, haversineKm, inTown } from '../../../shared/eat-now'
import { publicProse, publicVenueModules } from '../../../shared/fact-prose'
import { illustrationFor } from '../../../shared/illustrations'
import { attachSituationCards, toPublicListingModules } from '../../../shared/listing-modules'
import { renderMarkdown } from '../../../shared/markdown'
import { toPublicMedia } from '../../../shared/media'
import { buildPublicPrices, priceCompareLead, priceListNode } from '../../../shared/price-compare'
import { regionLabel } from '../../../shared/region'
import { isVerified, readRules, scheduleDetails, scheduleMarkup } from '../../../shared/schedule'
import { absoluteUrl, collectionDocument, socialImage, venueDocument } from '../../../shared/seo'
import { dishMenuNode, toPublicVenueModules } from '../../../shared/venue-modules'
import { FACT_UNKNOWN, omitFactGap, readShownFacts } from '../facts/read'
import { loadSchedule } from '../schedule'
import { loadComparablePrices, peersByItem } from './comparable-prices'
import { projectMenuPrices } from './menu-prices'

export function sponsoredVenuesEnabled() {
  return process.env.FEATURE_SPONSORED_VENUES === 'true'
}

const LISTING_SUMMARY = 'Кафе, кофейни и рестораны Калининградской области: часы, средний чек, адрес и как дойти от места. Карточки публикуются после проверки.'

/** Venues a town page shows in «Где поесть рядом». */
export const TOWN_EAT_LIMIT = 8

export async function eatNearby(origins: Array<{ latitude: number | null, longitude: number | null }>, options: { limit?: number } = {}) {
  const points = origins.flatMap((point) => {
    if (point.latitude == null || point.longitude == null) {
      return []
    }
    return [{ latitude: point.latitude, longitude: point.longitude }]
  })
  const found = await db.venues.nearby(points)
  const facts = await readShownFacts('venue', found.map((row) => ({
    id: row.id,
    address: row.address,
    phone: row.phone,
    latitude: row.latitude,
    longitude: row.longitude,
  })))
  const located = found.flatMap((row) => {
    const shown = facts.get(row.id)
    if (!shown || shown.status === 'closed' || shown.latitude == null || shown.longitude == null) {
      return []
    }
    const distanceKm = Math.min(...points.map((origin) => haversineKm(origin, { latitude: shown.latitude!, longitude: shown.longitude! })))
    if (distanceKm > NEARBY_RADIUS_KM) {
      return []
    }
    return [{ ...row, address: shown.address, phone: shown.phone, latitude: shown.latitude, longitude: shown.longitude, distanceKm }]
  })
  const ranked = rankNearby(located, { sponsoredSlot: sponsoredVenuesEnabled(), limit: options.limit ?? NEARBY_LIMIT })
  const covers = await db.venues.coversFor(ranked.map((row) => row.id))
  // Rules only: the browser computes «открыто сейчас» from them (ADR 0028).
  const schedules = await Promise.all(ranked.map((row) => loadSchedule('venue', row.id)))
  const regionSlugs = new Map((ranked.length ? await db.editor.listRegions() : []).map((row) => [row.id, row.slug]))
  const now = new Date()
  return ranked.map((row, index) => {
    const cover = covers.get(row.id)
    return {
      href: `/zavedeniya/${row.slug}`,
      slug: row.slug,
      name: row.name,
      kind: row.kind,
      kindLabel: kindLabel(row.kind),
      distanceKm: row.distanceKm,
      distance: formatVenueDistance(row.distanceKm),
      walk: formatWalk(row.distanceKm),
      cuisine: cuisineLabels(row.cuisineTags),
      check: row.avgCheck != null ? `~${new Intl.NumberFormat('ru-RU').format(row.avgCheck)} ₽` : '',
      partner: row.partner,
      stale: isStale(row.lastVerifiedAt, now),
      address: row.address,
      phone: row.phone,
      price: priceMarks(row.priceLevel),
      avgCheck: formatAvgCheck(row.avgCheck),
      media: cover ? toPublicMedia(cover) : null,
      schedule: schedules[index] ?? null,
      regionSlug: row.regionId ? regionSlugs.get(row.regionId) ?? null : null,
    }
  })
}

/** Places this far or closer are «рядом»; farther ones go to one line. */
export const NEAR_PLACES_KM = 3

function plainText(value: string) {
  return value.replace(/[#*_>`[\]]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * The hero lead: the SEO description, never the start of the body, so the
 * page does not say the same thing twice. Hidden when the body opens with it.
 */
export function venueLead(seo: string | null, body: string, max = 180) {
  const lead = seo?.trim() ? plainText(seo) : ''
  if (!lead) {
    return ''
  }
  const start = plainText(body).slice(0, 80).toLowerCase()
  if (start && lead.toLowerCase().startsWith(start.slice(0, 60))) {
    return ''
  }
  return venueSummary(lead, '', max)
}

/** One or two sentences for the hero: the SEO description, else the start of the description. */
export function venueSummary(seo: string | null, description: string, max = 180) {
  const source = (seo?.trim() || description.replace(/[#*_>`[\]]/g, '').trim())
  if (source.length <= max) {
    return source
  }
  const sentences = source.match(/[^.!?]+[.!?]+/g) ?? []
  let text = ''
  for (const sentence of sentences) {
    if ((text + sentence).trim().length > max) {
      break
    }
    text += sentence
  }
  return text.trim() || `${source.slice(0, max - 1).replace(/\s+\S*$/, '')}…`
}

async function regionSet() {
  const rows = await db.editor.listRegions()
  return {
    rows,
    slugs: new Set(rows.map((row) => row.slug)),
  }
}

export async function loadVenuePath(path: string) {
  const segments = path.split('?')[0]?.split('/').filter(Boolean) ?? []
  const tail = segments[0] === 'zavedeniya' ? segments.slice(1) : segments
  const regions = await regionSet()
  const resolved = resolveVenuePath(tail, regions.slugs)
  if (!resolved) {
    return null
  }
  if (resolved.type === 'venue') {
    return loadVenue(resolved.slug)
  }
  return loadListing(resolved.regionSlug, resolved.kind, regions.rows)
}

async function loadVenue(slug: string) {
  const venue = await db.venues.bySlug(slug)
  if (!venue || venue.status === 'draft') {
    return null
  }
  if (venue.status === 'archived') {
    return { type: 'gone' as const }
  }
  const region = venue.regionId
    ? (await db.editor.listRegions()).find((item) => item.id === venue.regionId) ?? null
    : null
  const gallery = await db.venues.gallery(venue.id)
  const photos = gallery.map((item) => toPublicMedia(item.media))
  const cover = photos.find((item, index) => gallery[index]?.isCover) ?? photos[0] ?? null
  const schedule = await loadSchedule('venue', venue.id)
  const hourLines = scheduleDetails(schedule?.rules ?? null)
  const body = publicProse(venue.description, hourLines)
  const moduleSource = publicVenueModules(venue.modules, hourLines)
  const now = new Date()
  const stale = isStale(venue.lastVerifiedAt, now)
  const shown = (await readShownFacts('venue', [{
    id: venue.id,
    phone: venue.phone,
    address: venue.address,
    latitude: venue.latitude,
    longitude: venue.longitude,
    status: venue.status,
  }])).get(venue.id)!
  const operatingClosed = shown.status === 'closed'
  const closedNote = operatingClosed ? CLOSED_NOTE : shown.statusGap ? FACT_UNKNOWN : ''
  const closed = Boolean(closedNote)
  const missingDescription = descriptionLength(venue.description) === 0
  const freshPrices = await db.prices.freshForVenue(venue.id)
  const [ownResolved, comparable] = await Promise.all([
    projectMenuPrices(freshPrices.map((row) => ({ ...row, venueId: venue.id }))),
    loadComparablePrices(),
  ])
  const ownPrices = ownResolved.map((item) => item.row)
  const wanted = new Set(ownPrices.map((row) => row.item))
  const peers = peersByItem(comparable.filter((row) => wanted.has(row.item)))
  const prices = buildPublicPrices({
    venueId: venue.id,
    venueSlug: venue.slug,
    regionId: venue.regionId,
    regionSlug: region?.slug ?? null,
    rows: ownPrices,
    peersByItem: peers,
  })
  const mediaById = new Map(photos.map((photo) => [photo.id, photo]))
  const modules = toPublicVenueModules(moduleSource, renderMarkdown, prices, {
    now,
    mediaById,
    priceLead: priceCompareLead(region?.slug ?? null),
    regionSlug: region?.slug ?? null,
    priceBand: venue.priceBand,
  })
  const town = region ? inTown(region.slug, regionLabel(region)) : ''
  const firstBlock = modules?.blocks.find((block) => block.type === 'text')
  const firstText = firstBlock?.type === 'text' ? firstBlock.html.replace(/<[^>]+>/g, ' ') : body
  const doc = venueDocument({
    slug: venue.slug,
    name: venue.name,
    kind: venue.kind,
    description: body || venue.name,
    regionTitle: region ? regionLabel(region) : null,
    address: omitFactGap(shown.address),
    latitude: shown.latitude,
    longitude: shown.longitude,
    phone: omitFactGap(shown.phone),
    website: venue.website,
    priceLevel: venue.priceLevel,
    cuisine: venue.cuisineTags,
    seoTitle: venue.seoTitle,
    seoDescription: venue.seoDescription,
    noindex: venue.noindex || venue.status === 'closed' || operatingClosed || missingDescription,
    image: cover ? socialImage(cover, cover.alt || venue.name) : null,
    kindLabel: kindLabel(venue.kind),
    inTown: town.startsWith('в ') ? town : null,
    regionSlug: region?.slug ?? null,
    cuisineLabels: cuisineLabels(venue.cuisineTags, 6),
    menuUrl: venue.menuUrl,
    reservation: venue.reservation,
  })
  const markup = scheduleMarkup(schedule, now)
  const business = doc.jsonLd.find((node) => {
    const type = node['@type']
    return type && type !== 'BreadcrumbList' && type !== 'FAQPage'
  })
  if (markup?.regular.length && business) {
    business.openingHoursSpecification = markup.regular
    if (markup.special.length) {
      business.specialOpeningHoursSpecification = markup.special
    }
  }
  const priceBlock = modules?.blocks.find((block) => block.type === 'prices')
  if (priceBlock?.type === 'prices') {
    const list = priceListNode(priceBlock.items, priceBlock.title)
    if (list) {
      doc.jsonLd.push({ '@context': 'https://schema.org', ...list })
    }
  }
  const dishes = modules?.blocks.find((block) => block.type === 'dishes')
  if (dishes?.type === 'dishes' && !doc.robots.includes('noindex')) {
    const menu = dishMenuNode(dishes, { menuUrl: venue.menuUrl, absolute: absoluteUrl })
    const business = doc.jsonLd.find((node) => {
      const type = node['@type']
      return type && type !== 'BreadcrumbList' && type !== 'FAQPage'
    })
    if (menu && business) {
      business.hasMenu = menu
    }
  }
  const faq = modules?.blocks.find((block) => block.type === 'faq')
  if (faq?.type === 'faq' && !doc.robots.includes('noindex')) {
    doc.jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': faq.items.map((item) => ({
        '@type': 'Question',
        'name': item.question,
        'acceptedAnswer': { '@type': 'Answer', 'text': item.html.replace(/<[^>]+>/g, '').trim() },
      })),
    })
  }
  const sponsored = await db.venues.sponsoredIds([venue.id])
  const places = shown.latitude != null && shown.longitude != null
    ? (await db.content.nearest(shown.latitude, shown.longitude, '', 6))
        // The town itself is in the crumbs, not a sight «рядом».
        .filter((place) => place.slug !== region?.slug)
    : []
  const placeCovers = await db.content.coversFor(places.map((place) => place.place_id))
  return {
    type: 'venue' as const,
    doc,
    venue: {
      slug: venue.slug,
      name: venue.name,
      kind: venue.kind,
      kindLabel: kindLabel(venue.kind),
      partner: sponsoredVenuesEnabled() && sponsored.has(venue.id),
      address: shown.address,
      phone: shown.phone,
      website: venue.website,
      price: priceMarks(venue.priceLevel),
      avgCheck: formatAvgCheck(venue.avgCheck),
      hours: isVerified(schedule) ? hourLines : schedule ? [] : [HOURS_UNKNOWN],
      hoursSet: hoursAreSet(normalizeHours(venue.hours)),
      description: body,
      html: renderMarkdown(body),
      latitude: shown.latitude,
      longitude: shown.longitude,
      stale,
      staleNote: stale ? STALE_NOTE : '',
      closed,
      closedNote,
      sources: venue.sources ?? [],
      cuisine: cuisineLabels(venue.cuisineTags, 4),
      socials: venue.socials ?? [],
      bookingUrl: venue.bookingUrl,
      orderUrl: venue.orderUrl,
      deliveryUrl: venue.deliveryUrl,
      menuUrl: venue.menuUrl,
      reservation: venue.reservation,
      takeaway: venue.takeaway,
      delivery: venue.delivery,
      dishes: venue.signatureDishes ?? [],
      summary: venueLead(venue.seoDescription, firstText),
      modules,
      checkedAt: venue.lastVerifiedAt,
      regionTitle: region ? regionLabel(region) : null,
      schedule,
    },
    photos,
    cover,
    places: places.filter((place) => Number(place.distance_km) <= NEAR_PLACES_KM).slice(0, 4).map((place) => {
      const media = placeCovers.get(place.place_id)
      return {
        href: `/${place.slug}`,
        text: place.title,
        distanceKm: Number(place.distance_km),
        kind: place.category_slug,
        media: media ? toPublicMedia(media) : null,
      }
    }),
    farPlaces: places.filter((place) => Number(place.distance_km) > NEAR_PLACES_KM).slice(0, 3).map((place) => ({
      href: `/${place.slug}`,
      text: place.title,
      distanceKm: Number(place.distance_km),
    })),
  }
}

async function loadListing(
  regionSlug: string | null,
  kind: string | null,
  regionRows: Array<{ id: string, slug: string, title: string, shortTitle?: string | null }>,
) {
  const region = regionSlug ? regionRows.find((row) => row.slug === regionSlug) ?? null : null
  if (regionSlug && !region) {
    return null
  }
  const intro = await db.venues.listingIntro(region?.id ?? null, kind)
  const indexable = descriptionLength(intro?.body || '') >= LISTING_INTRO_MIN
  // One pass for the page and for the town counts. A kind narrows both.
  const catalog = await db.venues.list({
    kind: kind ?? undefined,
    status: 'published',
    foodOnly: !kind,
  })
  const food = kind ? catalog : catalog.filter((row) => (FOOD_KINDS as readonly string[]).includes(row.kind))
  const draftModules = toPublicListingModules(intro?.modules ?? [], renderMarkdown)
  const situationSlugs = draftModules.flatMap((block) => block.type === 'situation' ? block.items.map((item) => item.placeSlug) : [])
  const extraSlugs = [...new Set(situationSlugs.filter((slug) => !food.some((row) => row.slug === slug)))]
  const extras = (await Promise.all(extraSlugs.map((slug) => db.venues.bySlug(slug)))).flatMap((row) => {
    return row && row.status === 'published' ? [row] : []
  })
  const facts = await readShownFacts('venue', [...food, ...extras].map((row) => ({
    id: row.id,
    phone: row.phone,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    status: row.status,
  })))
  const openFood = food.filter((row) => facts.get(row.id)?.status !== 'closed')
  const counts = new Map<string, number>()
  for (const row of openFood) {
    if (row.regionId) {
      counts.set(row.regionId, (counts.get(row.regionId) ?? 0) + 1)
    }
  }
  const shown = region ? openFood.filter((row) => row.regionId === region.id) : openFood
  const townRows = regionRows
    .filter((row) => (counts.get(row.id) ?? 0) > 0 || row.slug === regionSlug)
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      title: regionLabel(row),
      href: listingPath(row.slug, kind),
      count: counts.get(row.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, 'ru'))
  const hubs = await db.editor.publishedPlacesForSlugs(townRows.map((town) => town.slug))
  const hubCovers = await db.content.coversFor(hubs.map((hub) => hub.id))
  const hubBySlug = new Map(hubs.map((hub) => [hub.slug, hub]))
  const heading = listingHeading(region ? regionLabel(region) : null, kind)
  const summary = plainIntro(intro?.body) || LISTING_SUMMARY
  const doc = collectionDocument({
    path: listingPath(regionSlug, kind),
    h1: heading,
    summary,
    crumbName: 'список',
    parent: regionSlug || kind ? { name: 'Заведения', href: '/zavedeniya' } : undefined,
    items: shown.map((row) => ({ name: row.name, url: `/zavedeniya/${row.slug}` })),
    seoTitle: intro?.seoTitle,
    seoDescription: intro?.seoDescription,
    noindex: !indexable && Boolean(regionSlug || kind),
    kind: 'CollectionPage',
  })
  const now = new Date()
  const cardRows = [...shown, ...extras.filter((row) => facts.get(row.id)?.status !== 'closed')]
  const ids = cardRows.map((row) => row.id)
  const [covers, scheduleRows] = await Promise.all([
    db.venues.coversFor(ids),
    db.schedules.forEntities('venue', ids),
  ])
  const scheduleById = new Map(scheduleRows.flatMap((row) => {
    const rules = readRules(row.rules)
    return rules ? [[row.entityId, { rules, sourceUrl: row.sourceUrl, verifiedAt: row.verifiedAt }] as const] : []
  }))
  const cards = new Map(cardRows.map((row) => {
    const cover = covers.get(row.id)
    return [row.slug, {
      href: `/zavedeniya/${row.slug}`,
      slug: row.slug,
      name: row.name,
      kindLabel: kindLabel(row.kind),
      media: cover ? toPublicMedia(cover) : null,
      schedule: scheduleById.get(row.id) ?? null,
      stale: isStale(row.lastVerifiedAt, now),
      phone: facts.get(row.id)?.phone ?? null,
      meta: [facts.get(row.id)?.address, cuisineLabels(row.cuisineTags).join(', '), priceMarks(row.priceLevel), formatAvgCheck(row.avgCheck)].filter(Boolean).join(' · '),
    }] as const
  }))
  const modules = attachSituationCards(draftModules, cards)
  const faq = modules.find((block) => block.type === 'faq')
  if (faq?.type === 'faq' && !doc.robots.includes('noindex')) {
    doc.jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': faq.items.map((item) => ({
        '@type': 'Question',
        'name': item.question,
        'acceptedAnswer': { '@type': 'Answer', 'text': item.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() },
      })),
    })
  }
  return {
    type: 'listing' as const,
    doc,
    html: intro?.body?.trim() ? renderMarkdown(intro.body) : '',
    modules,
    heading,
    regionSlug,
    kind,
    filters: {
      allTownsHref: listingPath(null, kind),
      allKindsHref: listingPath(regionSlug, null),
      towns: townRows.map((town) => {
        const hub = hubBySlug.get(town.slug)
        const cover = hub ? hubCovers.get(hub.id) : undefined
        return {
          slug: town.slug,
          title: town.title,
          href: town.href,
          count: town.count,
          media: cover ? toPublicMedia(cover) : null,
          image: illustrationFor(hub?.categorySlug || 'kurorty', town.slug),
        }
      }),
      kinds: FOOD_KINDS.map((item) => ({
        kind: item,
        label: KIND_HEADING[item],
        href: listingPath(regionSlug, item),
      })),
    },
    items: shown.map((row) => {
      const card = cards.get(row.slug)
      return {
        href: `/zavedeniya/${row.slug}`,
        slug: row.slug,
        name: row.name,
        kindLabel: kindLabel(row.kind),
        address: facts.get(row.id)?.address ?? null,
        cuisine: cuisineLabels(row.cuisineTags),
        price: priceMarks(row.priceLevel),
        avgCheck: formatAvgCheck(row.avgCheck),
        phone: facts.get(row.id)?.phone ?? null,
        stale: isStale(row.lastVerifiedAt, now),
        latitude: facts.get(row.id)?.latitude ?? null,
        longitude: facts.get(row.id)?.longitude ?? null,
        media: card?.media ?? null,
        // Rules only. The card computes «открыто» in the browser (ADR 0028).
        schedule: card?.schedule ?? null,
      }
    }),
  }
}

function plainIntro(body: string | null | undefined) {
  const text = (body || '').replace(/[#>*_`[\]]/g, ' ').replace(/\s+/g, ' ').trim()
  return text.slice(0, 500)
}

function listingHeading(regionTitle: string | null, kind: string | null) {
  if (kind && regionTitle) {
    return `${kindHeading(kind)}: ${regionTitle}`
  }
  if (kind) {
    return kindHeading(kind)
  }
  if (regionTitle) {
    return `Заведения: ${regionTitle}`
  }
  return 'Заведения'
}

/** Towns with published food venues, for «Где поесть сейчас». */
async function eatNowTowns() {
  const [regionRows, rows] = await Promise.all([
    db.editor.listRegions(),
    db.venues.list({ status: 'published', foodOnly: true }),
  ])
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (row.regionId) {
      counts.set(row.regionId, (counts.get(row.regionId) ?? 0) + 1)
    }
  }
  return regionRows
    .filter((row) => counts.has(row.id))
    .map((row) => ({ ...row, label: regionLabel(row), count: counts.get(row.id) ?? 0, href: eatNowPath(row.slug) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ru'))
}

export async function loadEatNow(regionSlug: string | null) {
  const towns = await eatNowTowns()
  const townLinks = towns.map((town) => ({ slug: town.slug, title: town.label, href: town.href, count: town.count }))
  if (!regionSlug) {
    const doc = collectionDocument({
      path: EAT_NOW_PATH,
      h1: 'Где поесть сейчас',
      summary: 'Кафе, рестораны и пекарни Калининградской области с проверенными часами: что открыто прямо сейчас и что откроется позже, по городам.',
      crumbName: 'список',
      parent: { name: 'Еда', href: '/eda' },
      items: townLinks.map((town) => ({ name: `Где поесть сейчас ${inTown(town.slug, town.title)}`, url: town.href })),
      seoTitle: 'Где поесть сейчас: открытые кафе и рестораны по городам',
      seoDescription: 'Что открыто прямо сейчас в Калининграде, Светлогорске, Зеленоградске и других городах области: кафе и рестораны с проверенными часами работы.',
      kind: 'CollectionPage',
    })
    return { type: 'index' as const, doc, towns: townLinks }
  }
  const town = towns.find((row) => row.slug === regionSlug)
  if (!town) {
    return null
  }
  const rows = (await db.venues.list({ regionId: town.id, status: 'published', foodOnly: true }))
    .filter((row) => (FOOD_KINDS as readonly string[]).includes(row.kind))
  const facts = await readShownFacts('venue', rows.map((row) => ({
    id: row.id,
    phone: row.phone,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    status: row.status,
  })))
  const openRows = rows.filter((row) => facts.get(row.id)?.status !== 'closed')
  const located = openRows.flatMap((row) => {
    const shown = facts.get(row.id)
    if (!shown || shown.latitude == null || shown.longitude == null) {
      return []
    }
    return [{ latitude: shown.latitude, longitude: shown.longitude }]
  })
  const centre = town.latitude != null && town.longitude != null
    ? { latitude: town.latitude, longitude: town.longitude }
    : located.length
      ? {
          latitude: located.reduce((sum, row) => sum + row.latitude, 0) / located.length,
          longitude: located.reduce((sum, row) => sum + row.longitude, 0) / located.length,
        }
      : null
  const [covers, schedules] = await Promise.all([
    db.venues.coversFor(openRows.map((row) => row.id)),
    Promise.all(openRows.map((row) => loadSchedule('venue', row.id))),
  ])
  const now = new Date()
  const items = openRows.map((row, index) => {
    const shown = facts.get(row.id)!
    const distanceKm = centre && shown.latitude != null && shown.longitude != null
      ? haversineKm(centre, { latitude: shown.latitude, longitude: shown.longitude })
      : null
    const cover = covers.get(row.id)
    return {
      href: `/zavedeniya/${row.slug}`,
      slug: row.slug,
      name: row.name,
      kindLabel: kindLabel(row.kind),
      cuisine: cuisineLabels(row.cuisineTags),
      price: priceMarks(row.priceLevel),
      check: row.avgCheck != null ? `~${new Intl.NumberFormat('ru-RU').format(row.avgCheck)} ₽` : '',
      address: shown.address,
      phone: shown.phone,
      latitude: shown.latitude,
      longitude: shown.longitude,
      distanceKm,
      distance: distanceKm != null ? formatVenueDistance(distanceKm) : '',
      stale: isStale(row.lastVerifiedAt, now),
      media: cover ? toPublicMedia(cover) : null,
      schedule: schedules[index] ?? null,
    }
  }).sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
  const where = inTown(town.slug, town.label)
  const h1 = `Где поесть сейчас ${where}`
  const doc = collectionDocument({
    path: eatNowPath(town.slug),
    h1,
    summary: `${items.length} кафе, ресторанов и пекарен ${where}: что открыто прямо сейчас, что откроется позже, сколько идти от центра и средний чек.`,
    crumbName: 'список',
    parent: { name: 'Где поесть сейчас', href: EAT_NOW_PATH },
    items: items.map((item) => ({ name: item.name, url: item.href, latitude: item.latitude, longitude: item.longitude })),
    seoTitle: `Где поесть сейчас ${where}: открытые кафе и рестораны`,
    seoDescription: `Кафе и рестораны ${where}, открытые прямо сейчас: часы работы проверены, расстояние от центра, кухня и средний чек. ${items.length} заведений.`,
    kind: 'CollectionPage',
  })
  return {
    type: 'town' as const,
    doc,
    town: { slug: town.slug, title: town.label, where },
    centre,
    towns: townLinks,
    items,
  }
}
