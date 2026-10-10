import { eventCreateSchema } from '@k39/types'
import { describe, expect, it } from 'vitest'
import { project } from '../app/utils/forts-geometry'
import { canonicalRedirect } from '../shared/utils/canonical-redirect'

describe('apex redirect', () => {
  it('sends www to the apex with  a path and query', () => {
    expect(canonicalRedirect('www.k39.online', '/place/fort-11-denhoff?x=1')).toBe('https://k39.online/place/fort-11-denhoff?x=1')
    expect(canonicalRedirect('WWW.k39.online:443', '/')).toBe('https://k39.online/')
    expect(canonicalRedirect('www.k39.online, k39.online', '/map/kaliningrad')).toBe('https://k39.online/map/kaliningrad')
  })

  it('leaves the apex and local hosts alone', () => {
    expect(canonicalRedirect('k39.online', '/')).toBeNull()
    expect(canonicalRedirect('localhost:3000', '/')).toBeNull()
    expect(canonicalRedirect(undefined, '/')).toBeNull()
  })
})

describe('map projection', () => {
  it('puts the north-west corner at the origin', () => {
    const geo = { W: 1000, H: 900, K: 100, COS: 0.5, LON0: 20, LAT1: 55, water: '', islands: [], rivers: [], city: '', lakes: [] }
    expect(project(geo, 20, 55)).toEqual({ x: 0, y: 0 })
    const moved = project(geo, 20.2, 54.9)
    expect(moved.x).toBeCloseTo(10)
    expect(moved.y).toBeCloseTo(10)
  })
})

describe('event schema', () => {
  it('requires consent', () => {
    expect(eventCreateSchema.safeParse({ type: 'page_view', placeSlug: 'fort-11-denhoff', consent: true }).success).toBe(true)
    expect(eventCreateSchema.safeParse({ type: 'page_view', consent: false }).success).toBe(false)
    expect(eventCreateSchema.safeParse({ type: 'Page View', consent: true }).success).toBe(false)
  })
})
