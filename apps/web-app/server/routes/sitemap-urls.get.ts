import { db, isDatabaseReady } from '@k39/database'
import { CONSENT_PATH } from '../../shared/consent'
import { indexableHubs, LEGAL_LINKS, SECTION_LINKS } from '../../shared/links'
import { absoluteUrl } from '../../shared/seo'
import { venueKindMeta } from '../../shared/venues'

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
  const venueMap = await db.venues.sitemapRows()
  const categories = await db.content.categories()
  const hubs = indexableHubs(categories.filter((row) => row.noindex).map((row) => row.slug))
  const newest = [...rows.places, ...rows.routes, ...rows.collections, ...rows.quests]
    .map((row) => lastmod(row.lastmod))
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
  const staticPages = [
    { loc: absoluteUrl('/'), lastmod: newest },
    ...LEGAL_LINKS.map((link) => ({ loc: absoluteUrl(link.href) })),
    { loc: absoluteUrl(CONSENT_PATH) },
    ...hubs.map((link) => ({ loc: absoluteUrl(link.href) })),
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
    ...venueFilterUrls(venueMap.filters, venueMap.intros).map((row) => ({ loc: absoluteUrl(row.loc), lastmod: lastmod(row.lastmod) })),
    ...venueMap.venues.map((row) => ({
      loc: absoluteUrl(row.loc),
      lastmod: lastmod(row.lastmod),
      images: row.images.map((image) => ({ loc: absoluteUrl(image.loc), title: image.title })),
    })),
  ]
})

function venueFilterUrls(
  rows: Array<{ region_slug: string, kind: string, updated_at: string }>,
  intros: Array<{ regionSlug: string, kindSlug: string, updatedAt: string }>,
) {
  const pages = new Map<string, string>()
  const regions = new Map<string, string>()
  for (const row of rows) {
    const kind = venueKindMeta(row.kind).slug
    const regionPath = `/zavedeniya/${row.region_slug}`
    const previous = regions.get(regionPath)
    if (!previous || previous < row.updated_at) {
      regions.set(regionPath, row.updated_at)
    }
    pages.set(`${regionPath}/${kind}`, row.updated_at)
  }
  for (const [loc, lastmod] of regions) {
    pages.set(loc, lastmod)
  }
  for (const intro of intros) {
    if (!intro.regionSlug) {
      continue
    }
    const loc = intro.kindSlug
      ? `/zavedeniya/${intro.regionSlug}/${intro.kindSlug}`
      : `/zavedeniya/${intro.regionSlug}`
    if (!pages.has(loc)) {
      pages.set(loc, intro.updatedAt)
    }
  }
  return [...pages.entries()].map(([loc, lastmod]) => ({ loc, lastmod }))
}
