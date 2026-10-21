import { HUB_RENDERED_FIELDS } from '../../../../shared/page-modules'
import { requireEditor } from '../../../utils/access'
import { saveHubContent } from '../../../utils/content/save'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const body = await readBody(event)
  const { row, writingWarnings } = await saveHubContent(String(getRouterParam(event, 'id')), {
    title: String(body.title || ''),
    description: String(body.description || ''),
    body: body.body == null ? undefined : String(body.body),
    seoTitle: body.seoTitle || null,
    seoDescription: body.seoDescription || null,
    ogImage: body.ogImage || null,
    noindex: Boolean(body.noindex),
  }, {
    prose: [body.title, body.description, body.body, body.seoTitle, body.seoDescription],
    publishing: true,
  })
  return { ...row, writingWarnings, article: 'body' as const, renderedFields: HUB_RENDERED_FIELDS }
})
