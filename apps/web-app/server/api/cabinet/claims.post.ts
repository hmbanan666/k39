import { requireAccount } from '../../utils/cabinet/account'
import { startClaim } from '../../utils/cabinet/flow'

export default defineEventHandler(async (event) => {
  const user = await requireAccount(event)
  const body = await readBody(event)
  const channel = body?.channel
  if (channel !== 'email' && channel !== 'phone' && channel !== 'manual') {
    throw createError({ statusCode: 400, statusMessage: 'Выберите способ проверки' })
  }
  const slug = typeof body?.slug === 'string' ? body.slug : ''
  return startClaim(user.id, { slug, channel, evidence: typeof body?.evidence === 'string' ? body.evidence : null })
})
