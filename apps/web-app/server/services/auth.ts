import process from 'node:process'
import { db } from '@k39/database'

const logger = useLogger('user')

function isBootstrapAdmin(email: string) {
  const list = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  return list.includes(email.toLowerCase())
}

export async function findOrCreateUserByEmail(data: { email: string; name?: string | null }) {
  const existing = await db.user.findByEmail(data.email)
  const user =
    existing ??
    (await db.user.create({
      email: data.email,
      name: data.name?.trim() || 'Гость',
    }))
  if (!existing) {
    logger.success('New user created', user.id)
  }
  if (isBootstrapAdmin(user.email) && user.role !== 'admin') {
    const promoted = await db.user.update(user.id, { role: 'admin' })
    return promoted ?? user
  }
  return user
}
