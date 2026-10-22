import { requireAccount } from '../../../../utils/cabinet/account'
import { verifyClaimCode } from '../../../../utils/cabinet/flow'

export default defineEventHandler(async (event) => {
  const user = await requireAccount(event)
  const body = await readJsonBody(event)
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  return verifyClaimCode(user.id, getRouterParam(event, 'id') || '', code)
})
