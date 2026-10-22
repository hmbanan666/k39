import { db } from '@k39/database'
import { requireAccount } from '../../utils/cabinet/account'

export default defineEventHandler(async (event) => {
  const user = await requireAccount(event)
  const body = await readJsonBody(event)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (name.length < 1 || name.length > 80) {
    throw createError({ statusCode: 400, statusMessage: 'Имя: от 1 до 80 знаков' })
  }
  const saved = await db.user.update(user.id, { name })
  return { name: saved?.name ?? name }
})
