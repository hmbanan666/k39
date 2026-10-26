import { describe, expect, it } from 'vitest'
import { eatNowPath, groupEatNow, haversineKm, inTown } from '../shared/eat-now'

describe('eat now hub', () => {
  it('groups by status and keeps distance order', () => {
    const items = [
      { id: 'a', distanceKm: 0.9 },
      { id: 'b', distanceKm: 0.2 },
      { id: 'c', distanceKm: 0.5 },
      { id: 'd', distanceKm: null },
    ]
    const status: Record<string, 'open' | 'later' | 'unknown'> = { a: 'open', b: 'later', c: 'open', d: 'unknown' }
    const groups = groupEatNow(items, (item) => status[item.id]!)
    expect(groups.map((group) => [group.key, group.items.map((item) => item.id)])).toEqual([
      ['open', ['c', 'a']],
      ['later', ['b']],
      ['unknown', ['d']],
    ])
  })

  it('measures distance and names towns', () => {
    expect(haversineKm({ latitude: 54.9439, longitude: 20.1517 }, { latitude: 54.9439, longitude: 20.1517 })).toBe(0)
    expect(Math.round(haversineKm({ latitude: 54.71, longitude: 20.51 }, { latitude: 54.96, longitude: 20.48 }))).toBe(
      28,
    )
    expect(inTown('svetlogorsk', 'Светлогорск')).toBe('в Светлогорске и окрестностях')
    expect(eatNowPath('zelenogradsk')).toBe('/gde-poest-seychas/zelenogradsk')
  })
})

describe('client distance copies', () => {
  it('match the server formatters', async () => {
    const { clientDistance, clientWalk } = await import('../shared/eat-now')
    const { formatVenueDistance, formatWalk } = await import('@k39/database')
    for (const km of [0.004, 0.31, 0.99, 1.04, 2.5, 9.96, 14.2]) {
      expect(clientDistance(km)).toBe(formatVenueDistance(km))
      expect(clientWalk(km)).toBe(formatWalk(km))
    }
  })
})
