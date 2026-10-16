import type { CheaperSample } from '../../../shared/price-compare'
import { db, isStale, kindLabel } from '@k39/database'
import { toPublicMedia } from '../../../shared/media'
import {
  CHEAPER_PATH,
  cheaperCityMeta,
  cheaperCityPath,
  cheaperIndexMeta,
  formatRub,
  groupCheaperSamples,
  indexablePriceLocs,
  isPriceIndexable,
  knownPortion,
  onePricePerVenue,
  placesLabel,
  priceFreshnessText,
  priceItemImage,
  priceItemPath,
  priceItemSticker,
  priceListingMeta,
  priceSampleStats,
  sharedPriceSource,
  showsPriceSample,
} from '../../../shared/price-compare'
import { regionLabel } from '../../../shared/region'
import { readRules } from '../../../shared/schedule'
import { collectionDocument } from '../../../shared/seo'
import { omitFactGap, readShownFacts } from '../facts/read'
import { loadComparablePrices } from './comparable-prices'

/** Official fresh menu prices, one per venue and item, with closed venues removed. */
async function loadCheaperSamples(now = new Date()) {
  const [comparable, regions, catalog] = await Promise.all([
    loadComparablePrices(now),
    db.editor.listRegions(),
    db.prices.items(),
  ])
  const catalogBySlug = new Map(catalog.map((item) => [item.slug, item]))
  const regionById = new Map(regions.map((row) => [row.id, row]))
  const byItem = new Map<string, typeof comparable>()
  for (const row of comparable) {
    const list = byItem.get(row.item) ?? []
    list.push(row)
    byItem.set(row.item, list)
  }
  const samples: CheaperSample[] = []
  for (const [slug, list] of byItem) {
    const item = catalogBySlug.get(slug)
    for (const point of onePricePerVenue(list)) {
      const region = point.regionId ? regionById.get(point.regionId) : null
      samples.push({
        regionSlug: region?.slug ?? null,
        itemSlug: slug,
        itemTitle: item?.title ?? point.title,
        itemSort: item?.sortOrder ?? point.sortOrder,
        itemImage: item?.image ?? point.image,
        venueId: point.venueId,
        priceRub: point.priceRub,
        checkedAt: point.checkedAt,
        variant: point.variant,
        sourceTitle: point.sourceTitle,
        sourceUrl: point.sourceUrl,
      })
    }
  }
  const ids = [...new Set(samples.map((sample) => sample.venueId))]
  const facts = await readShownFacts('venue', ids.map((id) => ({ id, status: 'published' })))
  const open = samples.filter((sample) => facts.get(sample.venueId)?.status !== 'closed')
  return { samples: open, regions, catalog }
}

function listingStats(points: CheaperSample[]) {
  const stats = priceSampleStats(points.map((point) => point.priceRub))
  return {
    ...stats,
    places: points.length,
    freshness: priceFreshnessText(points.map((point) => point.checkedAt)),
    source: sharedPriceSource(points.map((point) => ({
      sourceTitle: point.sourceTitle,
      sourceUrl: point.sourceUrl,
      checkedAt: point.checkedAt,
    }))),
  }
}

/** One catalog item across venues, cheapest first. Reuses the official menu sample. */
export async function loadPriceListing(itemSlug: string, regionSlug: string | null) {
  const slug = itemSlug.trim().toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return null
  }
  const { samples, regions, catalog } = await loadCheaperSamples()
  const item = catalog.find((row) => row.slug === slug)
  if (!item) {
    return null
  }
  const wanted = regionSlug?.trim().toLowerCase() || null
  const region = wanted ? regions.find((row) => row.slug === wanted) ?? null : null
  if (wanted && !region) {
    return null
  }
  const grouped = groupCheaperSamples(samples.filter((sample) => sample.itemSlug === slug))
  const group = grouped.items.find((entry) => entry.slug === slug)
  const points = (region
    ? grouped.cities.find((city) => city.slug === region.slug)?.items.find((entry) => entry.slug === slug)?.points
    : group?.points) ?? []
  if (!showsPriceSample(points.length)) {
    return null
  }
  const ids = points.map((point) => point.venueId)
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
  const shownIds = new Set<string>()
  const items = points.flatMap((point) => {
    const venue = byId.get(point.venueId)
    const shownFacts = venue ? facts.get(venue.id) : undefined
    if (!venue || shownFacts?.status === 'closed') {
      return []
    }
    shownIds.add(venue.id)
    const cover = covers.get(venue.id)
    return [{
      href: `/zavedeniya/${venue.slug}`,
      slug: venue.slug,
      name: venue.name,
      kindLabel: kindLabel(venue.kind),
      media: cover ? toPublicMedia(cover) : null,
      schedule: scheduleById.get(venue.id) ?? null,
      stale: isStale(venue.lastVerifiedAt, now),
      meta: shownFacts?.address?.trim() && shownFacts.address !== 'уточняйте' ? shownFacts.address.trim() : '',
      phone: omitFactGap(shownFacts?.phone),
      priceLabel: formatRub(point.priceRub),
      variant: knownPortion(point.variant) ?? '',
    }]
  })
  if (!showsPriceSample(items.length)) {
    return null
  }
  const towns = grouped.cities
    .flatMap((city) => {
      const match = city.items.find((entry) => entry.slug === slug)
      if (!match) {
        return []
      }
      const row = regions.find((entry) => entry.slug === city.slug)
      return [{
        slug: city.slug,
        title: regionLabel(row) || city.slug,
        href: priceItemPath(slug, city.slug),
        count: match.count,
      }]
    })
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, 'ru'))
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
      ? { name: regionLabel(region) || region.slug, href: cheaperCityPath(region.slug) }
      : { name: 'Где дешевле', href: CHEAPER_PATH },
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
    stats: listingStats(points.filter((point) => shownIds.has(point.venueId))),
    items,
  }
}

function cityCards(cities: ReturnType<typeof groupCheaperSamples>['cities'], regions: Array<{ slug: string, title: string, shortTitle?: string | null }>) {
  return cities.map((city) => {
    const row = regions.find((entry) => entry.slug === city.slug)
    return {
      slug: city.slug,
      title: regionLabel(row) || city.slug,
      href: cheaperCityPath(city.slug),
      places: placesLabel(city.venueCount),
      venueCount: city.venueCount,
    }
  }).sort((a, b) => b.venueCount - a.venueCount || a.title.localeCompare(b.title, 'ru'))
}

/** Cities that have at least one comparable item. */
export async function loadCheaperIndex() {
  const { samples, regions } = await loadCheaperSamples()
  const grouped = groupCheaperSamples(samples)
  const cities = cityCards(grouped.cities, regions)
  const indexable = cities.some((city) => isPriceIndexable(city.venueCount))
  const meta = cheaperIndexMeta(indexable)
  const doc = collectionDocument({
    path: meta.path,
    h1: meta.h1,
    summary: meta.description,
    seoTitle: meta.seoTitle,
    seoDescription: meta.description,
    noindex: meta.noindex,
    crumbName: 'список',
    items: cities.map((city) => ({ name: city.title, url: city.href })),
    kind: 'CollectionPage',
  })
  return { doc, cities }
}

/** One city: items with at least three comparable official prices. */
export async function loadCheaperCity(regionSlug: string) {
  const slug = regionSlug.trim().toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return null
  }
  const { samples, regions } = await loadCheaperSamples()
  const region = regions.find((row) => row.slug === slug)
  if (!region) {
    return null
  }
  const grouped = groupCheaperSamples(samples)
  const city = grouped.cities.find((entry) => entry.slug === slug)
  if (!city) {
    return null
  }
  const meta = cheaperCityMeta({
    regionSlug: region.slug,
    regionName: regionLabel(region),
    venueCount: city.venueCount,
  })
  const items = city.items.map((item) => ({
    slug: item.slug,
    title: item.title,
    href: priceItemPath(item.slug, region.slug),
    image: priceItemImage(item.slug, item.image),
    sticker: priceItemSticker(item.slug, item.image),
    medianRub: item.medianRub,
    minRub: item.minRub,
    maxRub: item.maxRub,
    places: placesLabel(item.count),
  }))
  const doc = collectionDocument({
    path: meta.path,
    h1: meta.h1,
    summary: meta.description,
    seoTitle: meta.seoTitle,
    seoDescription: meta.description,
    noindex: meta.noindex,
    crumbName: 'список',
    parent: { name: 'Где дешевле', href: CHEAPER_PATH },
    items: items.map((item) => ({
      name: item.title,
      url: item.href,
      note: `${formatRub(item.medianRub)}, ${item.places}`,
    })),
    kind: 'CollectionPage',
  })
  return {
    doc,
    regionSlug: region.slug,
    cities: cityCards(grouped.cities, regions),
    items,
  }
}

/** Indexable price and city listings. Thin samples stay out of the sitemap. */
export async function priceSitemapEntries() {
  const { samples } = await loadCheaperSamples()
  const grouped = groupCheaperSamples(samples)
  const itemLocs = indexablePriceLocs(grouped.items.filter((item) => showsPriceSample(item.count)).map((item) => ({
    slug: item.slug,
    points: item.points.map((point) => ({
      regionSlug: point.regionSlug,
      checkedAt: point.checkedAt,
    })),
  })))
  const indexableCities = grouped.cities.filter((city) => isPriceIndexable(city.venueCount))
  const cityLocs = indexableCities.map((city) => ({ loc: cheaperCityPath(city.slug), lastmod: city.lastmod }))
  const indexLoc = indexableCities.length
    ? [{ loc: CHEAPER_PATH, lastmod: indexableCities.map((city) => city.lastmod).sort().at(-1) ?? null }]
    : []
  return [...indexLoc, ...cityLocs, ...itemLocs]
}
