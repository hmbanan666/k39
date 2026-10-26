import { eventCreateSchema } from '@k39/types'
import { describe, expect, it } from 'vitest'
import { haversineKm } from '../shared/links'
import { decideRedirect } from '../shared/redirects'

describe('apex redirect', () => {
  it('sends www to the apex and folds old place URLs into the final path', () => {
    expect(
      decideRedirect({
        hostHeader: 'www.k39.online',
        protoHeader: 'https',
        path: '/forty',
      }),
    ).toEqual({ kind: 'redirect', location: 'https://k39.online/forty' })
    expect(
      decideRedirect({
        hostHeader: 'WWW.k39.online:443',
        protoHeader: 'https',
        path: '/',
      }),
    ).toEqual({ kind: 'redirect', location: 'https://k39.online/' })
  })

  it('leaves localhost alone', () => {
    expect(decideRedirect({ hostHeader: 'localhost:3000', path: '/' }).kind).toBe('none')
    expect(decideRedirect({ hostHeader: undefined, path: '/' }).kind).toBe('none')
  })
})

describe('distance', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(54.7, 20.5, 54.7, 20.5)).toBe(0)
  })
})

describe('event schema', () => {
  it('requires consent', () => {
    expect(
      eventCreateSchema.safeParse({ type: 'page_view', placeSlug: 'fort-11-denhoff', consent: true }).success,
    ).toBe(true)
    expect(eventCreateSchema.safeParse({ type: 'page_view', consent: false }).success).toBe(false)
  })
})
