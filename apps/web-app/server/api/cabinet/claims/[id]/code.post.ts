import { requireAccount } from '../../../../utils/cabinet/account'
import { resendClaimCode } from '../../../../utils/cabinet/flow'

export default defineEventHandler(async (event) => {
  const user = await requireAccount(event)
  return resendClaimCode(user.id, getRouterParam(event, 'id') || '')
})
