import { db } from '@k39/database'
import { buildPublicPrices, priceBandFromBands } from '../../../shared/price-compare'

/**
 * Recompute the stored price band for every venue in one town.
 * One venue's prices change the sample for the others, so the whole town
 * is written together. Drafts are included: their own cards use published
 * peers, and they are not peers until they are published.
 */
export async function recomputeTownPriceBands(regionId: string | null, now = new Date()) {
  const town = await db.venues.inRegion(regionId)
  const freshByVenue = new Map<string, Awaited<ReturnType<typeof db.prices.freshForVenue>>>()
  const slugs = new Set<string>()
  for (const venue of town) {
    const fresh = await db.prices.freshForVenue(venue.id, now)
    freshByVenue.set(venue.id, fresh)
    for (const row of fresh) {
      slugs.add(row.item)
    }
  }
  const peersByItem: Record<string, Awaited<ReturnType<typeof db.prices.forItem>>> = {}
  for (const slug of slugs) {
    peersByItem[slug] = await db.prices.forItem(slug, now)
  }
  const computedAt = now.toISOString()
  const saved = []
  for (const venue of town) {
    const rows = freshByVenue.get(venue.id) ?? []
    const cards = buildPublicPrices({
      venueId: venue.id,
      venueSlug: venue.slug,
      regionId,
      regionSlug: null,
      rows,
      peersByItem,
    })
    const band = priceBandFromBands(cards.map((card) => card.comparison.band))
    await db.venues.setPriceBand(venue.id, { level: band.level, basis: band.basis, computedAt })
    saved.push({ id: venue.id, slug: venue.slug, level: band.level, basis: band.basis, computedAt })
  }
  return saved
}

/** Publication or a move between towns changes who is in the sample. */
export async function recomputePriceBandsAfterStatus(before: { regionId: string | null, status: string }, after: { regionId: string | null, status: string }) {
  const publicationChanged = (before.status === 'published') !== (after.status === 'published')
  const regionChanged = before.regionId !== after.regionId
  if (!publicationChanged && !regionChanged) {
    return
  }
  await recomputeTownPriceBands(before.regionId)
  if (regionChanged) {
    await recomputeTownPriceBands(after.regionId)
  }
}
