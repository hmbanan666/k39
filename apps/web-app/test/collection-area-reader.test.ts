import { renderToString } from '@vue/server-renderer'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createSSRApp, ref } from 'vue'
import CollectionPage from '../app/pages/podborki/[slug].vue'
import { loadCollection } from '../server/utils/public-pages'

const { publishedCollection, fetchPage } = vi.hoisted(() => ({ publishedCollection: vi.fn(), fetchPage: vi.fn() }))
vi.mock('@k39/database', async (original) => ({
  ...(await original<object>()),
  db: {
    content: {
      publishedCollection,
      collectionGallery: async () => [],
      coversFor: async () => new Map(),
      listPublishedCollections: async () => [],
    },
  },
}))
vi.mock('../server/utils/practical/public', () => ({ loadMemberEvents: async () => [] }))
vi.mock('../app/composables/fetchPublic', () => ({ fetchPublic: fetchPage }))
vi.mock('../app/composables/usePublicHead', () => ({ usePublicHead: vi.fn() }))

beforeEach(() => {
  publishedCollection.mockReset()
  fetchPage.mockReset()
  vi.stubGlobal('useVisitorPersona', () => ({ persona: ref(null), infer: vi.fn(), choose: vi.fn() }))
})
afterEach(() => vi.unstubAllGlobals())

it.each([
  ['theme', false],
  ['month', false],
  ['theme', true],
  ['month', true],
] as const)(
  'carries area labels through the reader and %s page (modules: %s), retaining subject identity',
  async (kind, modules) => {
    const items = [
      {
        id: 'primorsk',
        slug: 'primorsk',
        title: 'Приморск',
        summary: 'Самостоятельный предмет карточки.',
        categorySlug: 'kurorty',
        categoryTitle: 'Курорты',
        regionSlug: 'baltiysk',
        regionTitle: 'Балтийск',
        regionShortTitle: 'Балтийск',
      },
      {
        id: 'custom',
        slug: 'custom',
        title: 'Другой предмет',
        categorySlug: 'kurorty',
        categoryTitle: 'Курорты',
        regionSlug: 'coast',
        regionTitle: 'Побережье',
        regionShortTitle: null,
      },
      {
        id: 'unknown',
        slug: 'unknown',
        title: 'Без территории',
        regionSlug: null,
        regionTitle: null,
        regionShortTitle: null,
      },
    ]
    publishedCollection.mockResolvedValue({
      collection: {
        id: 'collection',
        slug: 'example',
        title: 'Проверка карточек',
        kind,
        month: kind === 'month' ? 11 : null,
        body: '',
        modules: modules ? [{ type: 'places', title: 'Места' }] : [],
      },
      items,
    })
    const page = await loadCollection('example')
    expect(page?.places.map(({ href, title, town }) => ({ href, title, town }))).toEqual([
      { href: '/primorsk', title: 'Приморск', town: 'Балтийск и окрестности' },
      { href: '/custom', title: 'Другой предмет', town: 'Территория «Побережье»' },
      { href: '/unknown', title: 'Без территории', town: '' },
    ])
    expect(publishedCollection).toHaveBeenCalledExactlyOnceWith('example')
    expect(items[0]?.regionTitle).toBe('Балтийск')
    fetchPage.mockResolvedValue(page)
    const html = await renderToString(createSSRApp(CollectionPage))
    expect(html).toContain('Курорты · Балтийск и окрестности')
    expect(html).toContain('href="/primorsk"')
    expect(html).toContain('Приморск')
    expect(html).toContain('Территория «Побережье»')
    expect(html).not.toContain('undefined')
  },
)
