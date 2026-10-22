import { adminNoticesView, adminNoticeTarget } from '../../../../../utils/notices/admin'

export default defineEventHandler(async (event) => {
  return adminNoticesView(await adminNoticeTarget(event))
})
