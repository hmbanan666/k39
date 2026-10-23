import { adminPracticalTarget } from '../../../../../utils/practical/admin'
import { admissionPatchInput, setAdmission } from '../../../../../utils/practical/admission'

const bodySchema = admissionPatchInput

export default defineEventHandler(async (event) => {
  const target = await adminPracticalTarget(event)
  const parsed = bodySchema.safeParse(await readJsonBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || 'Проверьте строки билетов' })
  }
  return setAdmission(target, parsed.data, 'editor')
})
