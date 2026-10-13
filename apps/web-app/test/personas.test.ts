import { describe, expect, it } from 'vitest'
import { orderPagePersonas, pagePersonasSchema, PERSONAS, personaTitle } from '../shared/personas'

describe('persona registry', () => {
  it('has eleven unique codes', () => {
    expect(PERSONAS).toHaveLength(11)
    expect(new Set(PERSONAS.map((persona) => persona.code)).size).toBe(11)
    expect(personaTitle('nocar')).toBe('Без машины')
  })
})

describe('page personas', () => {
  it('needs exactly one primary and known unique codes', () => {
    expect(pagePersonasSchema.safeParse([{ code: 'local', weight: 3, primary: true }, { code: 'history', weight: 2 }]).success).toBe(true)
    expect(pagePersonasSchema.safeParse([]).success).toBe(true)
    expect(pagePersonasSchema.safeParse([{ code: 'local', weight: 3 }]).success).toBe(false)
    expect(pagePersonasSchema.safeParse([{ code: 'local', primary: true }, { code: 'sea', primary: true }]).success).toBe(false)
    expect(pagePersonasSchema.safeParse([{ code: 'local', primary: true }, { code: 'local' }]).success).toBe(false)
    expect(pagePersonasSchema.safeParse([{ code: 'tourist', primary: true }]).success).toBe(false)
    expect(pagePersonasSchema.safeParse([{ code: 'sea', weight: 4, primary: true }]).success).toBe(false)
  })

  it('lists the primary first, then by weight', () => {
    const rows = [
      { personaCode: 'history', weight: 3, primary: false },
      { personaCode: 'local', weight: 2, primary: true },
      { personaCode: 'returning', weight: 1, primary: false },
    ]
    expect(orderPagePersonas(rows).map((row) => row.personaCode)).toEqual(['local', 'history', 'returning'])
  })
})
