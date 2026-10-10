import type { UserDraft, User as UserRecord } from '../types'
import { eq, sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { users } from '../tables'

export class User {
  static async find(id: string): Promise<UserRecord | undefined> {
    const [user] = await useDatabase().select().from(users).where(eq(users.id, id)).limit(1)
    return user
  }

  static async findByEmail(email: string): Promise<UserRecord | undefined> {
    const [user] = await useDatabase().select().from(users).where(eq(users.email, email)).limit(1)
    return user
  }

  static async create(data: UserDraft): Promise<UserRecord> {
    const [user] = await useDatabase().insert(users).values(data).returning()
    if (!user) {
      throw new Error('User creation failed')
    }
    return user
  }

  static async update(id: string, data: Partial<Pick<UserDraft, 'name' | 'avatarUrl' | 'role'>>) {
    const [user] = await useDatabase()
      .update(users)
      .set({
        ...data,
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, id))
      .returning()
    return user
  }
}
