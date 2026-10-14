import { describe, expect, it } from 'vitest'
import { inferPersona, isVisitorPersona, personaHints } from '../shared/visitor-persona'

describe('visitor persona', () => {
  it('turns a persona into hints for the questions a page asks', () => {
    expect(personaHints('nocar', ['interest', 'transport'])).toEqual({ transport: ['bez-mashiny'] })
    expect(personaHints('family', ['interest', 'transport'])).toEqual({})
    expect(personaHints('family', ['company'])).toEqual({ company: ['deti'] })
    expect(personaHints(null, ['transport'])).toEqual({})
  })

  it('infers a persona only from answers that say something about it', () => {
    expect(inferPersona({ transport: ['bez-mashiny'] })).toBe('nocar')
    expect(inferPersona({ company: ['deti'], transport: ['bez-mashiny'] })).toBe('family')
    expect(inferPersona({ interest: ['more'] })).toBeNull()
  })

  it('rejects unknown stored values', () => {
    expect(isVisitorPersona('nocar')).toBe(true)
    expect(isVisitorPersona('admin')).toBe(false)
  })
})
