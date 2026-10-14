import process from 'node:process'
import {
  CLOSED_NOTE,
  cuisineLabels,
  db,
  descriptionLength,
  FOOD_KINDS,
  formatAvgCheck,
  formatHoursLines,
  formatVenueDistance,
  formatWalk,
  hoursAreSet,
  isStale,
  KIND_HEADING,
  kindHeading,
  kindLabel,
  LISTING_INTRO_MIN,
  listingPath,
  NEARBY_LIMIT,
  normalizeHours,
  priceMarks,
  rankNearby,
  resolveVenuePath,
  STALE_NOTE,
} from '@k39/database'
import { renderMarkdown } from '../../../shared/markdown'
import { toPublicMedia } from '../../../shared/media'
import { regionLabel } from '../../../shared/region'
import { collectionDocument, socialImage, venueDocument } from '../../../shared/seo'
import { loadSchedule } from '../schedule'

export function sponsoredVenuesEnabled() {
  return process.env.FEATURE_SPONSORED_VENUES === 'true'
}

const LISTING_SUMMARY = 'Кафе, кофейни и рестораны Калининградской области: часы, средний чек, адрес и как дойти от места. Карточки публикуются после проверки.'

export async function eatNearby(origins: Array<{ latitude: number | null, longitude: number | null }>) {
  const points = origins.flatMap((point) => {
    if (point.latitude == null || point.longitude == null) {
      return []
    }
    return [{ latitude: point.latitude, longitude: point.longitude }]
  })
  const found = await db.venues.nearby(points)
  const ranked = rankNearby(found, { sponsoredSlot: sponsoredVenuesEnabled(), limit: NEARBY_LIMIT })
  const covers = await db.venues.coversFor(ranked.map((row) => row.id))
  // Rules only: the browser computes «открыто сейчас» from them (ADR 0028).
  const schedules = await Promise.all(ranked.map((row) => loadSchedule('venue', row.id)))
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
      price: priceMarks(row.priceLevel),
      avgCheck: formatAvgCheck(row.avgCheck),
      media: cover ? toPublicMedia(cover) : null,
      schedule: schedules[index] ?? null,
    }
  })
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
  const hours = normalizeHours(venue.hours)
  const openDays = hours.days.filter((day) => !day.closed && day.opens && day.closes)
  const now = new Date()
  const stale = isStale(venue.lastVerifiedAt, now)
  const closed = venue.status === 'closed'
  const missingDescription = descriptionLength(venue.description) === 0
  const doc = venueDocument({
    slug: venue.slug,
    name: venue.name,
    kind: venue.kind,
    description: venue.description,
    regionTitle: region ? regionLabel(region) : null,
    address: venue.address,
    latitude: venue.latitude,
    longitude: venue.longitude,
    phone: venue.phone,
    website: venue.website,
    priceLevel: venue.priceLevel,
    cuisine: venue.cuisineTags,
    hours: openDays.length ? hours.days : undefined,
    seoTitle: venue.seoTitle,
    seoDescription: venue.seoDescription,
    noindex: venue.noindex || closed || missingDescription,
    image: cover ? socialImage(cover, cover.alt || venue.name) : null,
  })
  const sponsored = await db.venues.sponsoredIds([venue.id])
  const places = venue.latitude != null && venue.longitude != null
    ? await db.content.nearest(venue.latitude, venue.longitude, '', 4)
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
      address: venue.address,
      phone: venue.phone,
      website: venue.website,
      price: priceMarks(venue.priceLevel),
      avgCheck: formatAvgCheck(venue.avgCheck),
      hours: formatHoursLines(hours),
      hoursSet: hoursAreSet(hours),
      description: venue.description,
      html: renderMarkdown(venue.description),
      latitude: venue.latitude,
      longitude: venue.longitude,
      stale,
      staleNote: stale ? STALE_NOTE : '',
      closed,
      closedNote: closed ? CLOSED_NOTE : '',
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
      summary: venueSummary(venue.seoDescription, venue.description),
      checkedAt: venue.lastVerifiedAt,
      regionTitle: region ? regionLabel(region) : null,
      schedule: await loadSchedule('venue', venue.id),
    },
    photos,
    cover,
    places: places.map((place) => {
      const media = placeCovers.get(place.place_id)
      return {
        href: `/${place.slug}`,
        text: place.title,
        distanceKm: Number(place.distance_km),
        kind: place.category_slug,
        media: media ? toPublicMedia(media) : null,
      }
    }),
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
  const rows = await db.venues.list({
    regionId: region?.id,
    kind: kind ?? undefined,
    status: 'published',
    foodOnly: !kind,
  })
  const shown = kind ? rows : rows.filter((row) => (FOOD_KINDS as readonly string[]).includes(row.kind))
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
  return {
    type: 'listing' as const,
    doc,
    html: intro?.body?.trim() ? renderMarkdown(intro.body) : '',
    heading,
    regionSlug,
    kind,
    filters: {
      regions: regionRows.map((row) => ({ slug: row.slug, title: regionLabel(row), href: listingPath(row.slug, kind) })),
      kinds: FOOD_KINDS.map((item) => ({
        kind: item,
        label: KIND_HEADING[item],
        href: listingPath(regionSlug, item),
      })),
    },
    items: shown.map((row) => ({
      href: `/zavedeniya/${row.slug}`,
      name: row.name,
      kindLabel: kindLabel(row.kind),
      address: row.address,
      price: priceMarks(row.priceLevel),
      avgCheck: formatAvgCheck(row.avgCheck),
      stale: isStale(row.lastVerifiedAt, now),
    })),
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
