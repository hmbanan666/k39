// Legal mark for links to Meta products. Detection is by host, so a later
// contact field, button, or markdown link picks it up without a new special case.
// Plain text only: callers must not add a Meta logo or brand icon.

export const META_PRODUCT_ORDER = ['instagram', 'facebook', 'threads', 'whatsapp'] as const

export type MetaProduct = (typeof META_PRODUCT_ORDER)[number]

const PRODUCT_LABEL: Record<MetaProduct, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  threads: 'Threads',
  whatsapp: 'WhatsApp',
}

// Host match is the name or a subdomain. wa.me and whatsapp.com are included so
// WhatsApp is handled the same way as the other Meta products.
const META_HOSTS: ReadonlyArray<{ host: string; product: MetaProduct }> = [
  { host: 'instagram.com', product: 'instagram' },
  { host: 'facebook.com', product: 'facebook' },
  { host: 'fb.com', product: 'facebook' },
  { host: 'threads.net', product: 'threads' },
  { host: 'whatsapp.com', product: 'whatsapp' },
  { host: 'wa.me', product: 'whatsapp' },
]

export function metaProductLabel(product: MetaProduct) {
  return PRODUCT_LABEL[product]
}

function hostIs(hostname: string, domain: string) {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return host === domain || host.endsWith(`.${domain}`)
}

/** Instagram, Facebook, Threads, or WhatsApp when the URL is on a Meta host. */
export function metaProductFromHref(href: string): MetaProduct | null {
  const trimmed = href.trim()
  if (!trimmed) {
    return null
  }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null
  }
  const found = META_HOSTS.find((rule) => hostIs(url.hostname, rule.host))
  return found?.product ?? null
}

export function metaMarkHtml(href: string) {
  return metaProductFromHref(href) ? '<sup class="meta-mark">*</sup>' : ''
}

function joinProducts(labels: string[]) {
  if (labels.length <= 1) {
    return labels[0] ?? ''
  }
  if (labels.length === 2) {
    return `${labels[0]} и ${labels[1]}`
  }
  return `${labels.slice(0, -1).join(', ')} и ${labels[labels.length - 1]}`
}

/** Footnote for the products actually linked. Empty when the page has none. */
export function metaFootnote(products: readonly MetaProduct[]) {
  const labels = META_PRODUCT_ORDER.filter((product) => products.includes(product)).map(
    (product) => PRODUCT_LABEL[product],
  )
  if (!labels.length) {
    return ''
  }
  const verb = labels.length === 1 ? 'принадлежит' : 'принадлежат'
  return `* ${joinProducts(labels)} ${verb} компании Meta, признанной экстремистской и запрещённой в России.`
}

const HREF_ATTR = /href\s*=\s*["']([^"']+)["']/gi

/** Products linked from an HTML fragment, in the stable product order. */
export function metaProductsInHtml(html: string) {
  const found = new Set<MetaProduct>()
  for (const match of html.matchAll(HREF_ATTR)) {
    const href = (match[1] ?? '').replace(/&amp;/g, '&')
    const product = metaProductFromHref(href)
    if (product) {
      found.add(product)
    }
  }
  return META_PRODUCT_ORDER.filter((product) => found.has(product))
}
