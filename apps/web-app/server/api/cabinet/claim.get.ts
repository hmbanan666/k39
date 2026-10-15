import { getQuery } from 'h3'
import { requireAccount } from '../../utils/cabinet/account'
import { claimPreview } from '../../utils/cabinet/flow'

export default defineEventHandler(async (event) => {
  const user = await requireAccount(event)
  const slug = String(getQuery(event).slug || '')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен адрес заведения' })
  }
  return claimPreview(user.id, slug)
})
