import type { UserConsent } from '../types'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { userConsents, users } from '../tables'

export interface ConsentRow {
  id: string
  userId: string
  email: string
  version: string
  consentedAt: string
  method: string
  withdrawnAt: string | null
}

export class Consent {
  static async active(userId: string, version: string): Promise<UserConsent | undefined> {
    const [row] = await useDatabase()
      .select()
      .from(userConsents)
      .where(and(
        eq(userConsents.userId, userId),
        eq(userConsents.version, version),
        isNull(userConsents.withdrawnAt),
      ))
      .limit(1)
    return row
  }

  static async record(data: { userId: string, version: string, method: string }): Promise<UserConsent> {
    const current = await this.active(data.userId, data.version)
    if (current) {
      return current
    }
    try {
      const [row] = await useDatabase().insert(userConsents).values(data).returning()
      if (!row) {
        throw new Error('Consent insert failed')
      }
      return row
    } catch (error) {
      const again = await this.active(data.userId, data.version)
      if (again) {
        return again
      }
      throw error
    }
  }

  static async list(limit = 100): Promise<ConsentRow[]> {
    return useDatabase()
      .select({
        id: userConsents.id,
        userId: userConsents.userId,
        email: users.email,
        version: userConsents.version,
        consentedAt: userConsents.consentedAt,
        method: userConsents.method,
        withdrawnAt: userConsents.withdrawnAt,
      })
      .from(userConsents)
      .innerJoin(users, eq(users.id, userConsents.userId))
      .orderBy(desc(userConsents.consentedAt))
      .limit(limit)
  }

  static async withdraw(id: string): Promise<UserConsent | undefined> {
    const [existing] = await useDatabase().select().from(userConsents).where(eq(userConsents.id, id)).limit(1)
    if (!existing || existing.withdrawnAt) {
      return existing
    }
    const [row] = await useDatabase()
      .update(userConsents)
      .set({ withdrawnAt: sql`now()` })
      .where(and(eq(userConsents.id, id), isNull(userConsents.withdrawnAt)))
      .returning()
    return row ?? existing
  }
}
