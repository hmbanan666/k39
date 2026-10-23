import { beforeEach, expect, it, vi } from 'vitest'
import { saveCollectionDraft } from '../server/utils/mcp/collections'

const { list, draft, store, audit } = vi.hoisted(() => ({
  list: vi.fn(), draft: vi.fn(), store: vi.fn(), audit: vi.fn(),
}))
vi.mock('@k39/database', async (original) => ({
  ...await original<object>(),
  db: { editor: { listCollections: list, contentDraft: draft, collectionItems: async () => [] } },
}))
vi.mock('../server/utils/access', () => ({ contentScope: () => 'draft' }))
vi.mock('../server/utils/mcp/audit', () => ({ auditMcp: audit }))
vi.mock('../server/utils/content/save', async (original) => ({
  ...await original<object>(), savePendingDraftContent: store,
}))

const sources = (count: number) => Array.from({ length: count }, (_, index) => ({ title: `Источник ${index}`, url: `https://example.com/${index}` }))
beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue([{
    id: 'fixture', slug: 'fixture', title: 'Подборка', body: 'Текст.',
    publicationStatus: 'published', kind: 'classic', month: null, modules: [], sources: sources(29),
  }])
  draft.mockResolvedValue(null)
  store.mockResolvedValue({ row: {}, writingWarnings: [] })
})

it('rejects an inherited over-limit live list before storing a pending draft or audit', async () => {
  await expect(saveCollectionDraft({ id: 'fixture', body: 'Правка текста.' })).rejects.toMatchObject({
    statusCode: 400,
    statusMessage: expect.stringMatching(/29.*опубликованной версии.*Не больше 24.*sources/u),
  })
  expect(store).not.toHaveBeenCalled()
  expect(audit).not.toHaveBeenCalled()
})

it('identifies a legacy pending list and preserves it on a rejected re-save', async () => {
  draft.mockResolvedValue({ payload: { sources: sources(25), body: 'Старая правка.' } })
  await expect(saveCollectionDraft({ id: 'fixture', body: 'Ещё правка.' })).rejects.toMatchObject({
    statusCode: 400,
    statusMessage: expect.stringMatching(/25.*ожидающего черновика.*Не больше 24/u),
  })
  expect(store).not.toHaveBeenCalled()
})

it('accepts an explicit corrected list and an explicit clear without inheriting the old list', async () => {
  draft.mockResolvedValue({ payload: { sources: sources(25) } })
  const corrected = sources(24)
  await saveCollectionDraft({ id: 'fixture', sources: corrected })
  expect(store.mock.calls[0]?.[0].payload.sources).toEqual(corrected)
  await saveCollectionDraft({ id: 'fixture', sources: [] })
  expect(store.mock.calls[1]?.[0].payload.sources).toEqual([])
})

it('dedupes inherited sources before counting and names malformed inherited rows', async () => {
  const repeated = Array.from({ length: 29 }, (_, index) => ({ title: `Источник ${index}`, url: index % 2 ? 'http://www.example.com/page/' : 'https://example.com/page' }))
  draft.mockResolvedValue({ payload: { sources: repeated } })
  await saveCollectionDraft({ id: 'fixture' })
  expect(store.mock.calls[0]?.[0].payload.sources).toEqual([repeated[0]])
  store.mockClear()
  draft.mockResolvedValue({ payload: { sources: [{ title: 'Плохая ссылка', url: 'ftp://example.com' }] } })
  await expect(saveCollectionDraft({ id: 'fixture' })).rejects.toMatchObject({
    statusCode: 400,
    statusMessage: expect.stringMatching(/ожидающего черновика.*Источник 1.*http/u),
  })
  expect(store).not.toHaveBeenCalled()
})

it('keeps the canonical error for an explicitly supplied invalid list', async () => {
  await expect(saveCollectionDraft({ id: 'fixture', sources: sources(25) })).rejects.toMatchObject({
    statusCode: 400, statusMessage: 'Не больше 24 источников',
  })
  expect(store).not.toHaveBeenCalled()
})
