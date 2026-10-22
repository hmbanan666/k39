/**
 * Prose we write versus official names, per entity.
 * The stop-list and venue copy rules read `prose` only.
 * Banned sites read `prose` and `names`, including URLs.
 *
 * Names: a venue name, a dish `name`, a source `title`, a price-item name,
 * and the verbatim fields kept beside them (address, phone, URLs) so a
 * banned site in those still fails. Descriptions, SEO fields, and module
 * text we write are prose. Place, collection, and route titles are prose:
 * we write them. Their source titles are names.
 */

export type WritingEntity = 'venue' | 'place' | 'collection' | 'route'

export interface WritingSplit {
  prose: string[]
  names: string[]
}

const PAGE_SKIP = new Set([
  'type',
  'variant',
  'role',
  'tags',
  'questions',
  'kind',
  'icon',
  'key',
  'param',
  'placeSlug',
  'slug',
  'id',
  'mediaId',
  'updatedAt',
])

export function writingSplit(entity: WritingEntity, input: Record<string, unknown> | null | undefined): WritingSplit {
  const prose: string[] = []
  const names: string[] = []
  if (!input) {
    return { prose, names }
  }
  if (entity === 'venue') {
    splitVenue(input, prose, names)
  } else if (entity === 'place') {
    splitPlace(input, prose, names)
  } else if (entity === 'collection') {
    splitCollection(input, prose, names)
  } else {
    splitRoute(input, prose, names)
  }
  return { prose, names }
}

function splitVenue(input: Record<string, unknown>, prose: string[], names: string[]) {
  pushText(names, input.name)
  pushText(names, input.address)
  pushText(names, input.phone)
  pushText(names, input.website)
  pushText(names, input.bookingUrl)
  pushText(names, input.orderUrl)
  pushText(names, input.deliveryUrl)
  pushText(names, input.menuUrl)
  pushText(names, input.contactEmail)
  pushText(prose, input.description)
  pushText(prose, input.seoTitle)
  pushText(prose, input.seoDescription)
  splitSocials(input.socials, names)
  splitDishes(input.signatureDishes, prose, names)
  splitVenueModules(input.modules, prose, names)
  splitSources(input.sources, names)
  splitPrices(input.prices, names)
}

function splitPlace(input: Record<string, unknown>, prose: string[], names: string[]) {
  splitArticle(input, prose)
  walkProse(input.sections, prose, PAGE_SKIP)
  walkProse(input.faq, prose, PAGE_SKIP)
  splitSources(input.sources, names)
  pushText(names, input.phone)
  pushText(names, input.phoneSourceUrl)
  pushText(names, input.website)
}

function splitCollection(input: Record<string, unknown>, prose: string[], names: string[]) {
  splitArticle(input, prose)
  walkProse(input.modules, prose, PAGE_SKIP)
  splitStops(input.items, prose)
  splitSources(input.sources, names)
}

function splitRoute(input: Record<string, unknown>, prose: string[], names: string[]) {
  splitArticle(input, prose)
  walkProse(input.sections, prose, PAGE_SKIP)
  splitStops(input.points, prose)
  splitStops(input.items, prose)
  splitSources(input.sources, names)
}

/** Title, summary, body, and SEO. `copy` is a rendered module projection. */
function splitArticle(input: Record<string, unknown>, prose: string[]) {
  pushText(prose, input.title)
  pushText(prose, input.summary)
  pushText(prose, input.body)
  pushText(prose, input.copy)
  pushText(prose, input.hours)
  pushText(prose, input.price)
  pushText(prose, input.howToGet)
  pushText(prose, input.seoTitle)
  pushText(prose, input.seoDescription)
  pushText(prose, input.visitDuration)
  pushText(prose, input.bestTime)
}

function splitSocials(value: unknown, names: string[]) {
  if (!Array.isArray(value)) {
    return
  }
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const row = item as Record<string, unknown>
    pushText(names, row.network)
    pushText(names, row.url)
  }
}

function splitDishes(value: unknown, prose: string[], names: string[]) {
  if (!Array.isArray(value)) {
    return
  }
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const row = item as Record<string, unknown>
    pushText(names, row.name)
    pushText(prose, row.description)
    pushText(prose, row.note)
  }
}

function splitVenueModules(value: unknown, prose: string[], names: string[]) {
  if (!Array.isArray(value)) {
    return
  }
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const row = item as Record<string, unknown>
    pushText(prose, row.title)
    pushText(prose, row.text)
    pushText(prose, row.note)
    if (row.type === 'dishes') {
      splitDishes(row.items, prose, names)
      continue
    }
    if (row.type === 'prices') {
      splitPrices(row.items, names)
      continue
    }
    walkProse(row.items, prose, PAGE_SKIP)
  }
}

function splitPrices(value: unknown, names: string[]) {
  if (!Array.isArray(value)) {
    return
  }
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const row = item as Record<string, unknown>
    pushText(names, row.title)
    pushText(names, row.name)
    pushText(names, row.sourceTitle)
    pushText(names, row.sourceUrl)
    pushText(names, row.variant)
  }
}

function splitSources(value: unknown, names: string[]) {
  if (!Array.isArray(value)) {
    return
  }
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const row = item as Record<string, unknown>
    pushText(names, row.title)
    pushText(names, row.url)
  }
}

function splitStops(value: unknown, prose: string[]) {
  if (!Array.isArray(value)) {
    return
  }
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue
    }
    pushText(prose, (item as Record<string, unknown>).note)
  }
}

function walkProse(value: unknown, prose: string[], skip: ReadonlySet<string>) {
  if (typeof value === 'string') {
    pushText(prose, value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      walkProse(item, prose, skip)
    }
    return
  }
  if (!value || typeof value !== 'object') {
    return
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (skip.has(key)) {
      continue
    }
    walkProse(item, prose, skip)
  }
}

function pushText(bucket: string[], value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    bucket.push(value)
  }
}
