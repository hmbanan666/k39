import type { MetaProduct } from '~~/shared/meta-links'
import { META_PRODUCT_ORDER, metaFootnote, metaProductFromHref, metaProductsInHtml } from '~~/shared/meta-links'

// Request-scoped via useState. Callers must note links before MetaFootnote
// renders: keep that component after the links in the same synchronous tree.
// A footnote placed after an async page boundary is set up too early and stays empty.
export function useMetaNotice() {
  const route = useRoute()
  const byPath = useState<Record<string, MetaProduct[]>>('k39-meta-products', () => ({}))

  function add(product: MetaProduct | null) {
    if (!product) {
      return
    }
    const key = route.fullPath
    const current = byPath.value[key] ?? []
    if (current.includes(product)) {
      return
    }
    const next = META_PRODUCT_ORDER.filter((item) => current.includes(item) || item === product)
    byPath.value = { ...byPath.value, [key]: next }
  }

  function noteHref(href: string) {
    add(metaProductFromHref(href))
  }

  function noteHtml(html: string) {
    for (const product of metaProductsInHtml(html)) {
      add(product)
    }
  }

  const footnote = computed(() => metaFootnote(byPath.value[route.fullPath] ?? []))

  // Reader and article shell can both mount a footnote. The first one in this
  // render shows it. Kept off the payload so hydration does not treat it as claimed.
  function claimFootnote() {
    const nuxtApp = useNuxtApp() as ReturnType<typeof useNuxtApp> & { _metaFootnote?: { path: string } }
    const key = route.fullPath
    if (nuxtApp._metaFootnote?.path === key) {
      return false
    }
    nuxtApp._metaFootnote = { path: key }
    return true
  }

  return { noteHref, noteHtml, footnote, claimFootnote }
}
