import { describe, expect, it } from 'vitest'
import { illustrationFor, POSTMARK_SRC } from '../shared/illustrations'

describe('moodboard illustrations', () => {
  it('maps a category to its file and falls back to the fort', () => {
    expect(illustrationFor('forty')).toBe('/illustrations/fort.svg')
    expect(illustrationFor('zamki')).toBe('/illustrations/castle.svg')
    expect(illustrationFor('plyazhi')).toBe('/illustrations/beach.svg')
    expect(illustrationFor('kurorty')).toBe('/illustrations/dunes.svg')
    expect(illustrationFor('muzei')).toBe('/illustrations/museum.svg')
    expect(illustrationFor('eda')).toBe('/illustrations/food.svg')
    expect(illustrationFor('unknown')).toBe('/illustrations/fort.svg')
    expect(illustrationFor(null)).toBe('/illustrations/fort.svg')
    expect(illustrationFor('muzei', 'kafedralnyi-sobor')).toBe('/illustrations/cathedral.svg')
    expect(POSTMARK_SRC).toBe('/illustrations/postmark.svg')
  })
})
