import type { RouteDraft, Route as RouteRecord } from '../types'
import { eq, sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { routePoints, routes } from '../tables'

export class Route {
  static async findBySlug(slug: string): Promise<RouteRecord | undefined> {
    const [route] = await useDatabase().select().from(routes).where(eq(routes.slug, slug)).limit(1)
    return route
  }

  static async upsert(data: RouteDraft): Promise<RouteRecord> {
    const existing = await this.findBySlug(data.slug)
    if (!existing) {
      const [created] = await useDatabase().insert(routes).values(data).returning()
      if (!created) {
        throw new Error(`Route insert failed: ${data.slug}`)
      }
      return created
    }

    const [updated] = await useDatabase()
      .update(routes)
      .set({
        title: data.title,
        summary: data.summary ?? null,
        regionId: data.regionId,
        updatedAt: sql`now()`,
      })
      .where(eq(routes.id, existing.id))
      .returning()
    if (!updated) {
      throw new Error(`Route update failed: ${data.slug}`)
    }
    return updated
  }

  static async replacePoints(routeId: string, placeIds: string[]) {
    const db = useDatabase()
    await db.delete(routePoints).where(eq(routePoints.routeId, routeId))
    if (placeIds.length === 0) {
      return
    }
    await db.insert(routePoints).values(placeIds.map((placeId, position) => ({
      routeId,
      placeId,
      position,
    })))
  }
}
