import type { CatalogSnapshot } from '../types'
import { Place } from './place'
import { Quest } from './quest'
import { Region } from './region'
import { Route } from './route'

export class Catalog {
  static async apply(snapshot: CatalogSnapshot) {
    const region = await Region.upsert({
      slug: snapshot.region.slug,
      title: snapshot.region.title,
      description: snapshot.region.description ?? null,
    })

    const placeIds = new Map<string, string>()
    for (const place of snapshot.places) {
      const row = await Place.upsert({
        slug: place.slug,
        title: place.title,
        type: place.type,
        latitude: place.latitude,
        longitude: place.longitude,
        status: place.status,
        hours: place.hours ?? null,
        sourceUrl: place.sourceUrl ?? null,
        regionId: region.id,
      })
      placeIds.set(place.slug, row.id)
    }

    const route = await Route.upsert({
      slug: snapshot.route.slug,
      title: snapshot.route.title,
      summary: snapshot.route.summary ?? null,
      regionId: region.id,
    })
    await Route.replacePoints(route.id, snapshot.route.points.map((slug) => requirePlace(placeIds, slug)))

    const quest = await Quest.upsert({
      slug: snapshot.quest.slug,
      title: snapshot.quest.title,
      summary: snapshot.quest.summary ?? null,
      routeId: route.id,
    })
    await Quest.replaceSteps(quest.id, snapshot.quest.steps.map((step) => ({
      placeId: requirePlace(placeIds, step.placeSlug),
      title: step.title,
      prompt: step.prompt ?? null,
    })))
  }
}

function requirePlace(placeIds: Map<string, string>, slug: string) {
  const placeId = placeIds.get(slug)
  if (!placeId) {
    throw new Error(`Catalog references a missing place: ${slug}`)
  }
  return placeId
}
