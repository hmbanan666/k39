import { describe, expect, it } from 'vitest'
import { byteSpan } from '../server/utils/basemap-range'

describe('basemap byte ranges', () => {
  it('reads a whole file when Range is absent and slices an inclusive range', () => {
    expect(byteSpan(undefined, 1000)).toBe('all')
    expect(byteSpan('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 })
    expect(byteSpan('bytes=100-', 1000)).toEqual({ start: 100, end: 999 })
    expect(byteSpan('bytes=-20', 1000)).toEqual({ start: 980, end: 999 })
    expect(byteSpan('bytes=1000-1001', 1000)).toBe('unsatisfiable')
    expect(byteSpan('bytes=5-1', 1000)).toBe('unsatisfiable')
    expect(byteSpan('items=0-1', 1000)).toBe('unsatisfiable')
  })
})
