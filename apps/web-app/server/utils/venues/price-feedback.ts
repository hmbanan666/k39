import { buildPublicPrices } from '../../../shared/price-compare'
import { toPublicVenueModules } from '../../../shared/venue-modules'

export interface VenuePriceWarning {
  code: 'prices_hidden_missing_module'
  message: string
}

type PriceVenue = { id: string; slug: string; regionId: string | null; modules: unknown }

/** Rows have already passed the public official-price projection. Never changes modules. */
export function venuePriceWarnings(
  venue: PriceVenue,
  rows: Parameters<typeof buildPublicPrices>[0]['rows'],
  pending = false,
): VenuePriceWarning[] {
  if (!rows.length) {
    return []
  }
  const cards = buildPublicPrices({
    venueId: venue.id,
    venueSlug: venue.slug,
    regionId: venue.regionId,
    regionSlug: null,
    rows,
    peersByItem: {},
  })
  const rendered = toPublicVenueModules(venue.modules, (text) => text, cards)
  if (rendered?.blocks.some((block) => block.type === 'prices')) {
    return []
  }
  return [
    {
      code: 'prices_hidden_missing_module',
      message: `${pending ? 'После применения черновика официальные цены не будут показаны' : 'Сохранённые официальные цены не показаны'}: в modules нет блока «Ориентиры цен» (type: prices).`,
    },
  ]
}
