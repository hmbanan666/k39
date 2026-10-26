import { describe, expect, it } from 'vitest'
import { moduleAnchors, PAGE_SECTIONS, presentSections } from '../shared/page-sections'

describe('page sections', () => {
  it('keeps only rendered blocks in order', () => {
    const out = presentSections([
      [PAGE_SECTIONS.nearby, true],
      [PAGE_SECTIONS.faq, false],
      [PAGE_SECTIONS.sources, true],
    ])
    expect(out.map((s) => s.id)).toEqual(['ryadom', 'istochniki'])
  })

  it('anchors titled modules only, with unique ids', () => {
    const modules = [
      { type: 'text', title: 'Погода', body: 'a' },
      { type: 'text', body: 'b' },
      { type: 'text', title: 'Погода', body: 'c' },
    ] as never
    const out = moduleAnchors(modules)
    expect(out[1]).toBeNull()
    expect(out[0]?.id).not.toBe(out[2]?.id)
    expect(out[0]?.id.startsWith('b-')).toBe(true)
  })
})
