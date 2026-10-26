import type { EatNowData } from '../../app/components/EatNowPage.vue'
import { clientDistance, haversineKm } from '../../shared/eat-now'
import { collectionDocument } from '../../shared/seo'
import { venueAvailabilityFixture } from './venue-availability'

/** Isolated town data shared by mounted tests and browser review. */
export function eatNowLocationFixture(): Extract<EatNowData, { type: 'town' }> {
  const centre = { latitude: 54.695, longitude: 20.49 }
  return {
    type: 'town',
    doc: collectionDocument({
      path: '/gde-poest-seychas/fixture-town',
      h1: 'Где поесть сейчас: фикстура',
      summary: 'Кафе и кофейни: часы работы и расстояния.',
      items: [],
      kind: 'CollectionPage',
    }),
    town: { slug: 'fixture-town', title: 'Фикстура', where: 'в фикстуре' },
    centre,
    towns: [{ slug: 'fixture-town', title: 'Фикстура', href: '/gde-poest-seychas/fixture-town', count: 3 }],
    items: venueAvailabilityFixture().items.map((item) => {
      const distanceKm =
        item.latitude != null && item.longitude != null
          ? haversineKm(centre, { latitude: item.latitude, longitude: item.longitude })
          : null
      return { ...item, check: '', distanceKm, distance: distanceKm == null ? '' : clientDistance(distanceKm) }
    }),
  }
}
