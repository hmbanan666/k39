import { adminNoticeTarget } from '../../../../../utils/notices/admin'
import { setNotices } from '../../../../../utils/notices/write'

export default defineEventHandler(async (event) => {
  const target = await adminNoticeTarget(event)
  const body = await readJsonBody<{ notices?: unknown; pendingDraft?: unknown }>(event)
  return setNotices(
    {
      subjectType: target.type,
      id: target.id,
      notices: body?.notices,
      pendingDraft: body?.pendingDraft === 'discard' ? 'discard' : undefined,
    },
    'admin',
  )
})
