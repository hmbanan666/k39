import { adminNoticeTarget, decideVenueNoticeDraft } from '../../../../../utils/notices/admin'

export default defineEventHandler(async (event) => {
  const target = await adminNoticeTarget(event)
  const body = await readJsonBody<{ action?: unknown }>(event)
  return decideVenueNoticeDraft(target, body?.action)
})
