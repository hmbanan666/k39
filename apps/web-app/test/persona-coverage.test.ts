import { describe, expect, it } from 'vitest'
import { pageModulesSchema } from '../shared/page-modules'
import { pageBlocks, personaCoverage } from '../shared/persona-coverage'

const base = { hasBody: true, modules: [], stops: 0, sources: 0, faq: 0, hours: false, price: false, howToGet: false }

describe('persona coverage', () => {
  it('derives blocks from place data', () => {
    const blocks = pageBlocks({ ...base, pageType: 'place', hours: true, howToGet: true, sources: 2 })
    expect([...blocks].sort()).toEqual(['short-facts', 'sources', 'text', 'transport'])
  })

  it('counts module types and text roles', () => {
    const blocks = pageBlocks({
      ...base,
      pageType: 'collection',
      stops: 4,
      modules: [{ type: 'plans' }, { type: 'text', role: 'events' }, { type: 'month-stats' }],
    })
    expect(blocks.has('plans')).toBe(true)
    expect(blocks.has('events')).toBe(true)
    expect(blocks.has('places')).toBe(true)
  })

  it('gives route steps only to routes and quests with two stops', () => {
    expect(pageBlocks({ ...base, pageType: 'route', stops: 3 }).has('route-steps')).toBe(true)
    expect(pageBlocks({ ...base, pageType: 'collection', stops: 3 }).has('route-steps')).toBe(false)
  })

  it('scores the share of persona blocks and lists the missing ones', () => {
    const local = personaCoverage('local', new Set(['events', 'plans']))
    expect(local.score).toBe(67)
    expect(local.missing).toEqual(['open-closed'])
  })

  it('accepts a role on text modules', () => {
    const parsed = pageModulesSchema.parse([{ type: 'text', title: 'События', role: 'events', text: 'Ярмарка.' }])
    expect(parsed[0]).toMatchObject({ role: 'events' })
    expect(() => pageModulesSchema.parse([{ type: 'text', role: 'weather', text: 'x' }])).toThrow()
  })
})
