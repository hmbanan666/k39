import { db, isDatabaseReady } from '@k39/database'
import { CONSENT_PATH } from '../../shared/consent'
import { HUBS, LEGAL_LINKS, SECTION_LINKS } from '../../shared/links'
import { absoluteUrl } from '../../shared/seo'

function lastmod(value: string | null | undefined) {
  if (!value) {
    return undefined
  }
  const normalized = value.includes('T') ? value : value.replace(' ', 'T').replace(/\+00$/, 'Z')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }
  return date.toISOString()
}

export default defineEventHandler(async () => {
  if (!isDatabaseReady()) {
    return []
  }
  const rows = await db.content.sitemapRows()
  const newest = [...rows.places, ...rows.routes, ...rows.collections, ...rows.quests]
    .map((row) => lastmod(row.lastmod))
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
  const staticPages = [
    { loc: absoluteUrl('/'), lastmod: newest },
    ...LEGAL_LINKS.map((link) => ({ loc: absoluteUrl(link.href) })),
    { loc: absoluteUrl(CONSENT_PATH) },
    ...HUBS.map((link) => ({ loc: absoluteUrl(link.href) })),
    ...SECTION_LINKS.map((link) => ({ loc: absoluteUrl(link.href) })),
  ]
  return [
    ...staticPages,
    ...rows.places.map((row) => ({
      loc: absoluteUrl(row.loc),
      lastmod: lastmod(row.lastmod),
      images: row.images.map((image) => ({ loc: absoluteUrl(image.loc), title: image.title })),
    })),
    ...rows.routes.map((row) => ({ loc: absoluteUrl(row.loc), lastmod: lastmod(row.lastmod) })),
    ...rows.collections.map((row) => ({ loc: absoluteUrl(row.loc), lastmod: lastmod(row.lastmod) })),
    ...rows.quests.map((row) => ({ loc: absoluteUrl(row.loc), lastmod: lastmod(row.lastmod) })),
  ]
})
