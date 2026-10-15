import { db } from '@k39/database'
import { toPublicMedia } from '../../../../shared/media'
import { requireAccount } from '../../../utils/cabinet/account'
import { requireVenueMember } from '../../../utils/cabinet/flow'

export default defineEventHandler(async (event) => {
  const user = await requireAccount(event)
  const id = getRouterParam(event, 'id') || ''
  const member = await requireVenueMember(user.id, id)
  const venue = await db.venues.byId(id)
  if (!venue) {
    throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
  }
  const gallery = await db.venues.gallery(venue.id)
  const [prices, catalog] = await Promise.all([
    db.prices.forVenue(venue.id),
    db.prices.items(),
  ])
  return {
    role: member.role,
    venue: {
      id: venue.id,
      slug: venue.slug,
      name: venue.name,
      kind: venue.kind,
      status: venue.status,
      description: venue.description,
      cuisineTags: venue.cuisineTags,
      address: venue.address,
      phone: venue.phone,
      website: venue.website,
      socials: venue.socials,
      bookingUrl: venue.bookingUrl,
      orderUrl: venue.orderUrl,
      deliveryUrl: venue.deliveryUrl,
      menuUrl: venue.menuUrl,
      reservation: venue.reservation,
      takeaway: venue.takeaway,
      delivery: venue.delivery,
      signatureDishes: venue.signatureDishes,
      priceLevel: venue.priceLevel,
      priceBand: venue.priceBand,
      priceBandComputedAt: venue.priceBandComputedAt,
      priceBandBasis: venue.priceBandBasis,
      avgCheck: venue.avgCheck,
      modules: venue.modules,
      hours: venue.hours,
    },
    prices,
    catalog: catalog.map((item) => ({
      slug: item.slug,
      title: item.title,
      category: item.category,
      defaultVariant: item.defaultVariant,
    })),
    photos: gallery.map((item) => ({
      ...toPublicMedia(item.media),
      origin: item.origin,
      isCover: item.isCover,
    })),
  }
})
