import { db } from '@k39/database'
import { createError } from 'h3'
import { HUB_RENDERED_FIELDS } from '../../../shared/page-modules'
import { requireEditorContent } from '../access'
import { saveHubContent } from '../content/save'
import { auditMcp } from './audit'

export interface HubUpdateInput {
  slug: string
  title?: string
  description?: string
  body?: string
  seoTitle?: string | null
  seoDescription?: string | null
  ogImage?: string | null
  noindex?: boolean
}

/** Hub list rows. `renderedFields` is what the hub page shows; body is the article. */
export async function listHubs() {
  const rows = await db.content.categories()
  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    description: row.description,
    body: row.body,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    ogImage: row.ogImage,
    noindex: row.noindex,
    article: 'body' as const,
    renderedFields: HUB_RENDERED_FIELDS,
  }))
}

/** Hub update. Omitting a field keeps the stored value. */
export async function updateHub(input: HubUpdateInput) {
  requireEditorContent('edit a hub')
  const current = await db.content.categoryBySlug(input.slug)
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Раздел не найден' })
  }
  const title = input.title ?? current.title
  const description = input.description ?? current.description
  const body = input.body === undefined ? current.body : input.body
  const seoTitle = input.seoTitle === undefined ? current.seoTitle : input.seoTitle
  const seoDescription = input.seoDescription === undefined ? current.seoDescription : input.seoDescription
  const { row, writingWarnings } = await saveHubContent(
    current.id,
    {
      title,
      description,
      body,
      seoTitle,
      seoDescription,
      ogImage: input.ogImage === undefined ? current.ogImage : input.ogImage,
      noindex: input.noindex ?? current.noindex,
    },
    {
      prose: [title, description, body, seoTitle, seoDescription],
      publishing: true,
    },
  )
  await auditMcp('hub_update', 'hub', current.id)
  return {
    id: row?.id,
    slug: row?.slug,
    title: row?.title,
    description: row?.description,
    body: row?.body,
    seoTitle: row?.seoTitle,
    seoDescription: row?.seoDescription,
    ogImage: row?.ogImage,
    noindex: row?.noindex,
    article: 'body' as const,
    renderedFields: HUB_RENDERED_FIELDS,
    writingWarnings,
  }
}
