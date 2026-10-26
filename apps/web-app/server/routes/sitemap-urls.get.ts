import { db, isDatabaseReady } from '@k39/database'
import { CONSENT_PATH } from '../../shared/consent'
import { EAT_NOW_PATH } from '../../shared/eat-now'
import { indexableHubs, LEGAL_LINKS } from '../../shared/links'
import { absoluteUrl } from '../../shared/seo'
import { latestSitemapLastmod, sitemapLastmod } from '../utils/sitemap-fields'
import { priceSitemapEntries } from '../utils/venues/price-page'
import { loadEatNow } from '../utils/venues/public'

function imageEntries(images: Array<{ loc: string; title?: string | null }>) {
  const listed = images.flatMap((image) => {
    const loc = image.loc.trim()
    if (!loc) {
      return []
    }
    const title = image.title?.trim()
    return [{ loc: absoluteUrl(loc), ...(title ? { title } : {}) }]
  })
  return listed.length ? listed : undefined
}

function entry(loc: string, lastmod?: string | null, images?: Array<{ loc: string; title?: string | null }>) {
  const pictures = images ? imageEntries(images) : undefined
  const stamp = sitemapLastmod(lastmod)
  return {
    loc: absoluteUrl(loc),
    ...(stamp ? { lastmod: stamp } : {}),
    ...(pictures ? { images: pictures } : {}),
  }
}

export default defineEventHandler(async () => {
  if (!isDatabaseReady()) {
    return []
  }
  const rows = await db.content.sitemapRows()
  const categories = await db.content.categories()
  const hidden = categories.filter((row) => row.noindex).map((row) => row.slug)
  const updated = new Map(categories.map((row) => [row.slug, row.updatedAt]))
  const contentLastmod = latestSitemapLastmod(
    [...rows.places, ...rows.routes, ...rows.collections, ...rows.quests, ...rows.venues, ...rows.venueListings].map(
      (row) => row.lastmod,
    ),
  )
  const sections = [
    { href: '/marshruty', lastmods: rows.routes.map((row) => row.lastmod) },
    { href: '/podborki', lastmods: rows.collections.map((row) => row.lastmod) },
    { href: '/kvesty', lastmods: rows.quests.map((row) => row.lastmod) },
    { href: '/zavedeniya', lastmods: rows.venues.map((row) => row.lastmod) },
  ]
  const eatNow = await loadEatNow(null)
  const venueLastmod = latestSitemapLastmod(rows.venues.map((row) => row.lastmod))
  const pricePages = await priceSitemapEntries()
  return [
    entry('/', contentLastmod),
    entry('/map'),
    ...(eatNow && eatNow.towns.length
      ? [entry(EAT_NOW_PATH, venueLastmod), ...eatNow.towns.map((town) => entry(town.href, venueLastmod))]
      : []),
    ...LEGAL_LINKS.map((link) => entry(link.href)),
    entry(CONSENT_PATH),
    ...indexableHubs(hidden).map((link) => entry(link.href, updated.get(link.href.slice(1)))),
    ...sections.map((section) => entry(section.href, latestSitemapLastmod(section.lastmods))),
    ...rows.places.map((row) => entry(row.loc, row.lastmod, row.images)),
    ...rows.routes.map((row) => entry(row.loc, row.lastmod)),
    ...rows.collections.map((row) => entry(row.loc, row.lastmod)),
    ...rows.quests.map((row) => entry(row.loc, row.lastmod)),
    ...rows.venues.map((row) => entry(row.loc, row.lastmod, row.images)),
    ...rows.venueListings.map((row) => entry(row.loc, row.lastmod)),
    ...pricePages.map((row) => entry(row.loc, row.lastmod)),
  ]
})
