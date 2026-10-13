import { describe, expect, it } from 'vitest'
import { splitCollections } from '../shared/month-guide'

describe('splitCollections', () => {
  it('orders month guides by month and keeps themes apart', () => {
    const rows = [
      { slug: 'b', title: 'B', kind: 'month', month: 3 },
      { slug: 'forts', title: 'Forts', kind: 'theme', month: null },
      { slug: 'a', title: 'A', kind: 'month', month: 1 },
    ]
    const { months, themes } = splitCollections(rows)
    expect(months.map((row) => row.slug)).toEqual(['a', 'b'])
    expect(themes.map((row) => row.slug)).toEqual(['forts'])
  })
})
