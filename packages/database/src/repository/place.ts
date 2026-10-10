import type { PlaceDraft, Place as PlaceRecord } from '../types'
import { eq, sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { places } from '../tables'

export class Place {
  static async findBySlug(slug: string): Promise<PlaceRecord | undefined> {
    const [place] = await useDatabase().select().from(places).where(eq(places.slug, slug)).limit(1)
    return place
  }

  static async upsert(data: PlaceDraft): Promise<PlaceRecord> {
    const existing = await this.findBySlug(data.slug)
    if (!existing) {
      const [created] = await useDatabase().insert(places).values(data).returning()
      if (!created) {
        throw new Error(`Place insert failed: ${data.slug}`)
      }
      return created
    }

    const [updated] = await useDatabase()
      .update(places)
      .set({
        title: data.title,
        type: data.type,
        latitude: data.latitude,
        longitude: data.longitude,
        status: data.status,
        hours: data.hours ?? null,
        sourceUrl: data.sourceUrl ?? null,
        regionId: data.regionId,
        updatedAt: sql`now()`,
      })
      .where(eq(places.id, existing.id))
      .returning()
    if (!updated) {
      throw new Error(`Place update failed: ${data.slug}`)
    }
    return updated
  }
}
