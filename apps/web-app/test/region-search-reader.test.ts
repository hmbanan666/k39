import type { H3Event } from 'h3'
import { beforeEach, expect, it, vi } from 'vitest'

const { query, listRegions, getQuery } = vi.hoisted(() => ({ query: vi.fn(), listRegions: vi.fn(), getQuery: vi.fn() }))
vi.mock('@k39/database', async (original) => ({
  ...(await original<object>()),
  db: { search: { query }, editor: { listRegions } },
}))
vi.mock('h3', async (original) => ({ ...(await original<object>()), getQuery }))
const handler = (await import('../server/api/search/index.get')).default

beforeEach(() => {
  query.mockReset()
  listRegions.mockReset()
  getQuery.mockReturnValue({ q: 'Зеленоградск' })
})

it('presents ranked reader results as areas without changing paths, kinds, scores or search inputs', async () => {
  const rows = [
    {
      kind: 'city',
      path: '/gde-poest-seychas/zelenogradsk',
      title: 'Зеленоградск',
      label: 'Город',
      region: '',
      snippet: '',
      score: 3,
    },
  ]
  query.mockResolvedValue(rows)
  listRegions.mockResolvedValue([{ slug: 'zelenogradsk', title: 'Историческое название', shortTitle: 'Зеленоградск' }])
  const result = await handler({} as H3Event)
  expect(query).toHaveBeenCalledExactlyOnceWith('Зеленоградск')
  expect(listRegions).toHaveBeenCalledTimes(1)
  expect(result.results).toEqual([{ ...rows[0], title: 'Зеленоградск и окрестности', label: 'Территория каталога' }])
  expect(rows[0]?.label).toBe('Город')
})

it('does not query region metadata for an empty search response', async () => {
  query.mockResolvedValue([])
  expect((await handler({} as H3Event)).results).toEqual([])
  expect(listRegions).not.toHaveBeenCalled()
})
