import { beforeEach, expect, it, vi } from 'vitest'
import { saveCollectionDraft } from '../server/utils/mcp/collections'

const { list, draft, store, audit } = vi.hoisted(() => ({
  list: vi.fn(),
  draft: vi.fn(),
  store: vi.fn(),
  audit: vi.fn(),
}))
vi.mock('@k39/database', async (original) => ({
  ...(await original<object>()),
  db: { editor: { listCollections: list, contentDraft: draft, collectionItems: async () => [] } },
}))
vi.mock('../server/utils/access', () => ({ contentScope: () => 'draft' }))
vi.mock('../server/utils/mcp/audit', () => ({ auditMcp: audit }))
vi.mock('../server/utils/content/save', async (original) => ({
  ...(await original<object>()),
  savePendingDraftContent: store,
}))

const sources = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ title: `Источник ${index}`, url: `https://example.com/${index}` }))
beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue([
    {
      id: 'fixture',
      slug: 'fixture',
      title: 'Подборка',
      body: 'Текст.',
      publicationStatus: 'published',
      kind: 'classic',
      month: null,
      modules: [],
      sources: sources(29),
    },
  ])
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
  const repeated = Array.from({ length: 29 }, (_, index) => ({
    title: `Источник ${index}`,
    url: index % 2 ? 'http://www.example.com/page/' : 'https://example.com/page',
  }))
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
    statusCode: 400,
    statusMessage: 'Не больше 24 источников',
  })
  expect(store).not.toHaveBeenCalled()
})

const malformedSources = [
  {},
  false,
  0,
  '',
  'sources',
  { length: 0 },
  [null],
  [false],
  [0],
  [[]],
  [{}],
  [{ title: 1, url: 'https://example.com' }],
  [{ title: false, url: 'https://example.com' }],
  [{ title: null, url: 'https://example.com' }],
  [{ title: {}, url: 'https://example.com' }],
  [{ title: 'Источник', url: 1 }],
  [{ title: 'Источник', url: false }],
  [{ title: 'Источник', url: null }],
  [{ title: 'Источник', url: {} }],
]

it.each(malformedSources.map((rows) => [rows]))(
  'refuses malformed pending sources %j before any write',
  async (rows) => {
    const pending = { payload: { sources: rows, body: 'Старая правка.' } }
    const before = structuredClone(pending)
    draft.mockResolvedValue(pending)
    await expect(saveCollectionDraft({ id: 'fixture', body: 'Правка текста.' })).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: expect.stringMatching(/ожидающего черновика.*sources/u),
    })
    expect(pending).toEqual(before)
    expect(store).not.toHaveBeenCalled()
    expect(audit).not.toHaveBeenCalled()
  },
)

it.each(malformedSources.map((rows) => [rows]))('refuses malformed live sources %j before any write', async (rows) => {
  const live = { ...(await list())[0], sources: rows }
  const before = structuredClone(live)
  list.mockResolvedValue([live])
  await expect(saveCollectionDraft({ id: 'fixture', body: 'Правка текста.' })).rejects.toMatchObject({
    statusCode: 400,
    statusMessage: expect.stringMatching(/опубликованной версии.*sources/u),
  })
  expect(live).toEqual(before)
  expect(store).not.toHaveBeenCalled()
  expect(audit).not.toHaveBeenCalled()
})

it.each([null, []].map((rows) => [rows]))('keeps inherited null/empty sources %j as an empty list', async (rows) => {
  draft.mockResolvedValue({ payload: { sources: rows } })
  await saveCollectionDraft({ id: 'fixture' })
  expect(store.mock.calls[0]?.[0].payload.sources).toEqual([])
})

it('uses live sources when pending sources are omitted and allows explicit repair of malformed JSON', async () => {
  const corrected = sources(1)
  list.mockResolvedValue([{ ...(await list())[0], sources: corrected }])
  draft.mockResolvedValue({ payload: { body: 'Старая правка.' } })
  await saveCollectionDraft({ id: 'fixture' })
  expect(store.mock.calls[0]?.[0].payload.sources).toEqual(corrected)
  draft.mockResolvedValue({ payload: { sources: {} } })
  await saveCollectionDraft({ id: 'fixture', sources: corrected })
  expect(store.mock.calls[1]?.[0].payload.sources).toEqual(corrected)
  await saveCollectionDraft({ id: 'fixture', sources: [] })
  expect(store.mock.calls[2]?.[0].payload.sources).toEqual([])
})
