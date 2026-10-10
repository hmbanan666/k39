import type { RegionDraft, Region as RegionRecord } from '../types'
import { eq, sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { regions } from '../tables'

export class Region {
  static async findBySlug(slug: string): Promise<RegionRecord | undefined> {
    const [region] = await useDatabase().select().from(regions).where(eq(regions.slug, slug)).limit(1)
    return region
  }

  static async upsert(data: RegionDraft): Promise<RegionRecord> {
    const existing = await this.findBySlug(data.slug)
    if (!existing) {
      const [created] = await useDatabase().insert(regions).values(data).returning()
      if (!created) {
        throw new Error(`Region insert failed: ${data.slug}`)
      }
      return created
    }

    const [updated] = await useDatabase()
      .update(regions)
      .set({
        title: data.title,
        description: data.description ?? null,
        updatedAt: sql`now()`,
      })
      .where(eq(regions.id, existing.id))
      .returning()
    if (!updated) {
      throw new Error(`Region update failed: ${data.slug}`)
    }
    return updated
  }
}
