import type { QuestDraft, Quest as QuestRecord } from '../types'
import { eq, sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { quests, questSteps } from '../tables'

export class Quest {
  static async findBySlug(slug: string): Promise<QuestRecord | undefined> {
    const [quest] = await useDatabase().select().from(quests).where(eq(quests.slug, slug)).limit(1)
    return quest
  }

  static async upsert(data: QuestDraft): Promise<QuestRecord> {
    const existing = await this.findBySlug(data.slug)
    if (!existing) {
      const [created] = await useDatabase().insert(quests).values(data).returning()
      if (!created) {
        throw new Error(`Quest insert failed: ${data.slug}`)
      }
      return created
    }

    const [updated] = await useDatabase()
      .update(quests)
      .set({
        title: data.title,
        summary: data.summary ?? null,
        routeId: data.routeId,
        updatedAt: sql`now()`,
      })
      .where(eq(quests.id, existing.id))
      .returning()
    if (!updated) {
      throw new Error(`Quest update failed: ${data.slug}`)
    }
    return updated
  }

  static async replaceSteps(questId: string, steps: Array<{ placeId: string, title: string, prompt?: string | null }>) {
    const db = useDatabase()
    await db.delete(questSteps).where(eq(questSteps.questId, questId))
    if (steps.length === 0) {
      return
    }
    await db.insert(questSteps).values(steps.map((step, position) => ({
      questId,
      placeId: step.placeId,
      position,
      title: step.title,
      prompt: step.prompt ?? null,
    })))
  }
}
