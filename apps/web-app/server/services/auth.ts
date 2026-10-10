import { db } from '@k39/database'

const logger = useLogger('user')

export async function findOrCreateUserByEmail(data: { email: string, name?: string | null }) {
  const existing = await db.user.findByEmail(data.email)
  if (existing) {
    return existing
  }

  const user = await db.user.create({
    email: data.email,
    name: data.name?.trim() || 'Гость',
  })
  logger.success('New user created', user.id)
  return user
}
