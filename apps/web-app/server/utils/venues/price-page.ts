import { db, isStale, kindLabel } from '@k39/database'
import { toPublicMedia } from '../../../shared/media'
import { formatRub, indexablePriceLocs, onePricePerVenue, priceItemImage, priceItemPath, priceItemSticker, priceListingMeta } from '../../../shared/price-compare'
import { regionLabel } from '../../../shared/region'
import { readRules } from '../../../shared/schedule'
import { collectionDocument } from '../../../shared/seo'
import { readShownFacts } from '../facts/read'

/** One catalog item across venues, cheapest first. Reuses `db.prices.forItem`. */
export async function loadPriceListing(itemSlug: string, regionSlug: string | null) {
  const slug = itemSlug.trim().toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return null
  }
  const catalog = await db.prices.items()
  const item = catalog.find((row) => row.slug === slug)
  if (!item) {
    return null
  }
  const [rows, regions] = await Promise.all([
    db.prices.forItem(slug),
    db.editor.listRegions(),
  ])
  const wanted = regionSlug?.trim().toLowerCase() || null
  const region = wanted ? regions.find((row) => row.slug === wanted) ?? null : null
  if (wanted && !region) {
    return null
  }
  const regionById = new Map(regions.map((row) => [row.id, row]))
  const points = onePricePerVenue(rows).map((row) => ({
    ...row,
    regionSlug: row.regionId ? regionById.get(row.regionId)?.slug ?? null : null,
  })).sort((a, b) => a.priceRub - b.priceRub || (b.checkedAt ?? '').localeCompare(a.checkedAt ?? ''))
  const shown = region ? points.filter((row) => row.regionId === region.id) : points
  if (!shown.length) {
    return null
  }
  const ids = shown.map((row) => row.venueId)
  const venues = (await db.venues.list({ status: 'published' })).filter((row) => ids.includes(row.id))
  const byId = new Map(venues.map((row) => [row.id, row]))
  const [covers, scheduleRows] = await Promise.all([
    db.venues.coversFor([...byId.keys()]),
    db.schedules.forEntities('venue', [...byId.keys()]),
  ])
  const scheduleById = new Map(scheduleRows.flatMap((row) => {
    const rules = readRules(row.rules)
    return rules ? [[row.entityId, { rules, sourceUrl: row.sourceUrl, verifiedAt: row.verifiedAt }] as const] : []
  }))
  const now = new Date()
  const facts = await readShownFacts('venue', [...byId.values()].map((venue) => ({
    id: venue.id,
    address: venue.address,
    latitude: venue.latitude,
    longitude: venue.longitude,
    phone: venue.phone,
    status: venue.status,
  })))
  const items = shown.flatMap((point) => {
    const venue = byId.get(point.venueId)
    const shownFacts = venue ? facts.get(venue.id) : undefined
    if (!venue || shownFacts?.status === 'closed') {
      return []
    }
    const cover = covers.get(venue.id)
    return [{
      href: `/zavedeniya/${venue.slug}`,
      slug: venue.slug,
      name: venue.name,
      kindLabel: kindLabel(venue.kind),
      media: cover ? toPublicMedia(cover) : null,
      schedule: scheduleById.get(venue.id) ?? null,
      stale: isStale(venue.lastVerifiedAt, now),
      meta: shownFacts?.address?.trim() || '',
      priceLabel: formatRub(point.priceRub),
      variant: point.variant,
    }]
  })
  if (!items.length) {
    return null
  }
  const counts = new Map<string, number>()
  for (const point of points) {
    if (point.regionSlug) {
      counts.set(point.regionSlug, (counts.get(point.regionSlug) ?? 0) + 1)
    }
  }
  const towns = [...counts.entries()].map(([townSlug, count]) => {
    const row = regions.find((entry) => entry.slug === townSlug)
    return {
      slug: townSlug,
      title: regionLabel(row) || townSlug,
      href: priceItemPath(slug, townSlug),
      count,
    }
  }).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, 'ru'))
  const meta = priceListingMeta({
    title: item.title,
    slug: item.slug,
    regionSlug: region?.slug ?? null,
    regionName: region ? regionLabel(region) : '',
    count: items.length,
  })
  const doc = collectionDocument({
    path: meta.path,
    h1: meta.h1,
    summary: meta.description,
    seoTitle: meta.seoTitle,
    seoDescription: meta.description,
    noindex: meta.noindex,
    crumbName: 'список',
    parent: region
      ? { name: item.title, href: priceItemPath(item.slug) }
      : { name: 'Заведения', href: '/zavedeniya' },
    items: items.map((row) => ({
      name: row.name,
      url: row.href,
      note: [row.priceLabel, row.variant].filter(Boolean).join(', '),
    })),
    kind: 'CollectionPage',
  })
  return {
    doc,
    item: {
      slug: item.slug,
      title: item.title,
      image: priceItemImage(item.slug, item.image),
      sticker: priceItemSticker(item.slug, item.image),
    },
    regionSlug: region?.slug ?? null,
    towns,
    oblastHref: priceItemPath(item.slug),
    items,
  }
}

/** Indexable /ceny listings. Counts are published venues from `Prices.forItem`. Thin samples stay out of the sitemap. */
export async function priceSitemapEntries() {
  const [catalog, regions] = await Promise.all([
    db.prices.items(),
    db.editor.listRegions(),
  ])
  const regionSlug = new Map(regions.map((row) => [row.id, row.slug]))
  const items = []
  for (const item of catalog) {
    const rows = await db.prices.forItem(item.slug)
    items.push({
      slug: item.slug,
      points: onePricePerVenue(rows).map((row) => ({
        regionSlug: row.regionId ? regionSlug.get(row.regionId) ?? null : null,
        checkedAt: row.checkedAt ?? '',
      })),
    })
  }
  return indexablePriceLocs(items)
}
