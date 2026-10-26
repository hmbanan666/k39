import { HUB_RENDERED_FIELDS } from '../../../shared/page-modules'
import { saveHubContent } from '../content/save'

/** Admin hub save. The page always renders the markdown body. */
export async function saveAdminHub(
  id: string,
  body: {
    title?: string
    description?: string
    body?: string | null
    seoTitle?: string | null
    seoDescription?: string | null
    ogImage?: string | null
    noindex?: boolean
  },
) {
  const { row, writingWarnings } = await saveHubContent(
    id,
    {
      title: String(body.title || ''),
      description: String(body.description || ''),
      body: body.body == null ? undefined : String(body.body),
      seoTitle: body.seoTitle || null,
      seoDescription: body.seoDescription || null,
      ogImage: body.ogImage || null,
      noindex: Boolean(body.noindex),
    },
    {
      prose: [body.title, body.description, body.body, body.seoTitle, body.seoDescription],
      publishing: true,
    },
  )
  return { ...row, writingWarnings, article: 'body' as const, renderedFields: HUB_RENDERED_FIELDS }
}
