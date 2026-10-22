import { db, isStale, kindLabel } from '@k39/database'
import { z } from 'zod'
import { toPublicMedia } from '../../../shared/media'
import { readShownFacts, shownText } from '../../utils/facts/read'
import { auditMcp } from '../../utils/mcp/audit'
import { loadSchedule } from '../../utils/schedule'

export default defineMcpTool({
  name: 'venue_get',
  description: 'Load one venue by id or slug, including photos (author, license, source, origin), the hours schedule (rules, sourceUrl, verifiedAt, as schedule_get returns them; null when none), action links, signature dishes, sources, createdAt, updatedAt, and whether the facts are stale.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    id: z.string().optional(),
    slug: z.string().optional(),
  },
  handler: async ({ id, slug }) => {
    const venue = id ? await db.venues.byId(id) : slug ? await db.venues.bySlug(slug) : null
    if (!venue) {
      throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
    }
    const gallery = await db.venues.gallery(venue.id)
    const regions = await db.editor.listRegions()
    const found = regions.find((item) => item.id === venue.regionId)
    await auditMcp('venue_get', 'venue', venue.id)
    return {
      id: venue.id,
      createdAt: venue.createdAt,
      updatedAt: venue.updatedAt,
      slug: venue.slug,
      name: venue.name,
      kind: venue.kind,
      kindLabel: kindLabel(venue.kind),
      cuisineTags: venue.cuisineTags,
      regionSlug: found?.slug ?? null,
      address: venue.address,
      latitude: venue.latitude,
      longitude: venue.longitude,
      priceLevel: venue.priceLevel,
      priceBand: venue.priceBand,
      priceBandComputedAt: venue.priceBandComputedAt,
      priceBandBasis: venue.priceBandBasis,
      avgCheck: venue.avgCheck,
      schedule: await loadSchedule('venue', venue.id),
      phone: shownText((await readShownFacts('venue', [{
        id: venue.id,
        phone: venue.phone,
        address: venue.address,
        latitude: venue.latitude,
        longitude: venue.longitude,
        status: venue.status,
      }])).get(venue.id)?.phone, venue.phone),
      website: venue.website,
      socials: venue.socials,
      vkCommunityId: venue.vkCommunityId,
      bookingUrl: venue.bookingUrl,
      orderUrl: venue.orderUrl,
      deliveryUrl: venue.deliveryUrl,
      menuUrl: venue.menuUrl,
      reservation: venue.reservation,
      takeaway: venue.takeaway,
      delivery: venue.delivery,
      signatureDishes: venue.signatureDishes,
      modules: venue.modules,
      prices: await db.prices.forVenue(venue.id),
      contactEmail: venue.contactEmail,
      description: venue.description,
      sources: venue.sources,
      status: venue.status,
      lastVerifiedAt: venue.lastVerifiedAt,
      stale: isStale(venue.lastVerifiedAt, new Date()),
      osmId: venue.osmId,
      seoTitle: venue.seoTitle,
      seoDescription: venue.seoDescription,
      noindex: venue.noindex,
      media: gallery.map((item) => ({
        ...toPublicMedia(item.media),
        isCover: item.isCover,
        sortOrder: item.sortOrder,
        origin: item.origin,
      })),
    }
  },
})
