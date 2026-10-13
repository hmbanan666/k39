import type { VenueKind } from '@k39/database'
import { db } from '@k39/database'
import { renderMarkdown } from '../../../shared/markdown'
import { toPublicMedia } from '../../../shared/media'
import { absoluteUrl, venueDocument, venueListingDocument } from '../../../shared/seo'
import { descriptionMissing, formatAvgCheck, formatPriceLevel, formatVenueHours, VENUE_KINDS, venueIsStale, venueKindBySlug, venueKindMeta } from '../../../shared/venues'

const LIVE = new Set(['published', 'closed'])

export async function loadVenue(slug: string) {
  const loaded = await db.venues.detailBySlug(slug)
  if (!loaded) {
    return null
  }
  if (loaded.venue.status === 'archived') {
    return { gone: true as const }
  }
  if (!LIVE.has(loaded.venue.status)) {
    return null
  }
  const gallery = loaded.gallery.map((item) => ({ ...toPublicMedia(item.media), isCover: item.isCover }))
  const cover = gallery.find((item) => item.isCover) ?? gallery[0] ?? null
  const image = cover
    ? { url: absoluteUrl(cover.src), width: cover.width, height: cover.height, alt: cover.alt || loaded.venue.name }
    : null
  const doc = venueDocument({
    slug: loaded.venue.slug,
    name: loaded.venue.name,
    description: loaded.venue.description,
    kind: loaded.venue.kind,
    regionTitle: loaded.region?.title ?? null,
    regionSlug: loaded.region?.slug ?? null,
    address: loaded.venue.address,
    latitude: loaded.venue.latitude,
    longitude: loaded.venue.longitude,
    phone: loaded.venue.phone,
    website: loaded.venue.website,
    priceLevel: loaded.venue.priceLevel,
    cuisine: loaded.venue.cuisine ?? [],
    hours: loaded.venue.hours,
    seoTitle: loaded.venue.seoTitle,
    seoDescription: loaded.venue.seoDescription,
    noindex: descriptionMissing(loaded.venue.description),
    sources: loaded.venue.sources ?? [],
    image,
  })
  const places = loaded.venue.latitude != null && loaded.venue.longitude != null
    ? await db.content.nearest(loaded.venue.latitude, loaded.venue.longitude, '', 6)
    : []
  return {
    gone: false as const,
    doc,
    venue: loaded.venue,
    region: loaded.region ? { slug: loaded.region.slug, title: loaded.region.title } : null,
    kindLabel: venueKindMeta(loaded.venue.kind).label,
    hours: formatVenueHours(loaded.venue.hours),
    priceLevel: formatPriceLevel(loaded.venue.priceLevel),
    avgCheck: formatAvgCheck(loaded.venue.avgCheck),
    stale: venueIsStale(loaded.venue.lastVerifiedAt),
    closed: loaded.venue.status === 'closed',
    gallery,
    cover,
    sources: loaded.venue.sources ?? [],
    socials: loaded.venue.socials ?? {},
    places: places.map((item) => ({
      href: `/${item.slug}`,
      text: item.title,
      distanceKm: Number(item.distance_km),
    })),
    html: loaded.venue.description.trim() ? renderMarkdown(loaded.venue.description) : '',
  }
}

export async function loadVenueListing(regionSlug?: string, kindSlug?: string) {
  const region = regionSlug ? await db.venues.regionBySlug(regionSlug) : null
  if (regionSlug && !region) {
    return null
  }
  const kind = kindSlug ? venueKindBySlug(kindSlug) : null
  if (kindSlug && !kind) {
    return null
  }
  const rows = await db.venues.listLive({
    regionId: region?.id ?? null,
    kind: (kind?.kind ?? null) as VenueKind | null,
  })
  const introRow = await db.venues.listingIntro(region?.slug ?? '', kind?.slug ?? '')
  const customIntro = introRow?.intro.trim() || ''
  const h1 = listingTitle(region?.title ?? null, kind?.plural ?? null)
  const summary = customIntro || defaultIntro(region?.title ?? null, kind?.plural ?? null)
  const indexable = rows.some((row) => row.description.trim().length > 0) || Boolean(customIntro)
  const path = listingPath(region?.slug ?? null, kind?.slug ?? null)
  const doc = venueListingDocument({
    path,
    h1,
    summary,
    region: region ? { title: region.title, slug: region.slug } : null,
    kind: Boolean(kind),
    items: rows.filter((row) => row.description.trim()).map((row) => ({
      name: row.name,
      url: `/zavedeniya/${row.slug}`,
    })),
    noindex: !indexable,
  })
  const regions = region ? [] : await db.venues.liveRegions()
  return {
    doc,
    h1,
    summary,
    html: customIntro ? renderMarkdown(customIntro) : '',
    region: region ? { slug: region.slug, title: region.title } : null,
    kind: kind ? { slug: kind.slug, label: kind.label, plural: kind.plural } : null,
    regions,
    kinds: VENUE_KINDS.map((item) => ({ slug: item.slug, label: item.plural })),
    items: rows.map((row) => ({
      href: `/zavedeniya/${row.slug}`,
      name: row.name,
      kindLabel: venueKindMeta(row.kind).label,
      address: row.address,
      stale: venueIsStale(row.lastVerifiedAt),
      closed: row.status === 'closed',
      price: formatAvgCheck(row.avgCheck) || formatPriceLevel(row.priceLevel),
    })),
  }
}

function listingPath(regionSlug: string | null, kindSlug: string | null) {
  if (regionSlug && kindSlug) {
    return `/zavedeniya/${regionSlug}/${kindSlug}`
  }
  if (regionSlug) {
    return `/zavedeniya/${regionSlug}`
  }
  return '/zavedeniya'
}

function listingTitle(regionTitle: string | null, kindPlural: string | null) {
  if (regionTitle && kindPlural) {
    return `${kindPlural}: ${regionTitle}`
  }
  if (regionTitle) {
    return `Где поесть: ${regionTitle}`
  }
  return 'Где поесть'
}

function defaultIntro(regionTitle: string | null, kindPlural: string | null) {
  if (regionTitle && kindPlural) {
    return `${kindPlural}, ${regionTitle}: адрес, часы и средний чек.`
  }
  if (regionTitle) {
    return `Кафе, кофейни и рестораны. ${regionTitle}.`
  }
  return 'Кафе, кофейни, бары и пекарни Калининградской области.'
}
