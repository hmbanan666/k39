import { z } from 'zod'
import { adminPracticalTarget } from '../../../../../utils/practical/admin'
import { admissionListInput, setAdmission } from '../../../../../utils/practical/admission'

const bodySchema = z.object({ rows: admissionListInput })

export default defineEventHandler(async (event) => {
  const target = await adminPracticalTarget(event)
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || 'Проверьте строки билетов' })
  }
  return setAdmission(target, parsed.data.rows, 'editor')
})
