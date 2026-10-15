import { describe, expect, it } from 'vitest'
import { newSearchId, resultsLabel, searchQueryParam, searchSurface } from '../shared/search'

describe('site search client helpers', () => {
  it('reads the query and the surface from the URL', () => {
    expect(searchQueryParam('  форты  ')).toBe('форты')
    expect(searchQueryParam(['замки', 'x'])).toBe('замки')
    expect(searchQueryParam(undefined)).toBe('')
    expect(searchQueryParam('я'.repeat(150))).toHaveLength(100)
    expect(searchSurface('header')).toBe('header')
    expect(searchSurface('404')).toBe('404')
    expect(searchSurface('evil')).toBe('page')
  })

  it('pluralizes the result count', () => {
    expect(resultsLabel(1)).toBe('1 результат')
    expect(resultsLabel(3)).toBe('3 результата')
    expect(resultsLabel(5)).toBe('5 результатов')
    expect(resultsLabel(11)).toBe('11 результатов')
    expect(resultsLabel(22)).toBe('22 результата')
  })

  it('makes an id the events endpoint accepts', () => {
    expect(newSearchId()).toMatch(/^[\w-]{8,64}$/)
  })
})
