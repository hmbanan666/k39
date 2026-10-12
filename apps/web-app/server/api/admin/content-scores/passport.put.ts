import { requireEditor } from '../../../utils/access'
import { resolveScoredPage, writePassport } from '../../../utils/scoring/run'
import { passportWriteSchema } from '../../../utils/scoring/schemas'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const input = passportWriteSchema.parse(await readBody(event))
  const page = await resolveScoredPage(input)
  if (!page) {
    throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' })
  }
  return writePassport(page, input)
})
