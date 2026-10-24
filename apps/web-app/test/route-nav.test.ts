import { describe, expect, it } from 'vitest'
import { externalLinkAttrs, haversineKm } from '../shared/links'
import { formatStraightLine, locatedStops, routeLinks, routeStopViews, yandexRouteUrl } from '../shared/route-nav'

const castles = [
  { href: '/zamok-tapiau', text: 'Замок Тапиау', note: 'Старт от кассы', latitude: 54.64528, longitude: 21.07472 },
  { href: '/zamok-insterburg', text: 'Замок Инстербург', note: '  Подвалы с гидом  ', latitude: 54.63972, longitude: 21.80667 },
  { href: '/zamok-ragnit', text: 'Замок Рагнит', note: null, latitude: 55.03917, longitude: 22.02972 },
]

describe('route navigation', () => {
  it('builds Yandex and Google links and labels the straight line', () => {
    const stops = routeStopViews(castles)
    expect(stops[1]?.note).toBe('Подвалы с гидом')
    expect(stops[2]?.distanceLabel).toBeNull()
    const firstKm = haversineKm(54.64528, 21.07472, 54.63972, 21.80667)
    expect(stops[0]?.distanceLabel).toBe(`${formatStraightLine(firstKm)} до следующей`)
    expect(stops[0]?.distanceLabel?.startsWith('около ')).toBe(true)

    const points = locatedStops(stops)
    expect(points.map((point) => point.label)).toEqual(['1', '2', '3'])
    const driving = routeLinks(points, 'auto')
    expect(driving?.yandex).toBe('https://yandex.ru/maps/?rtext=54.64528,21.07472~54.63972,21.80667~55.03917,22.02972&rtt=auto')
    expect(driving?.google).toContain('travelmode=driving')
    expect(decodeURIComponent(driving?.google || '')).toContain('54.64528,21.07472')
    expect(decodeURIComponent(driving?.google || '')).toContain('54.63972,21.80667')
    expect(yandexRouteUrl(points, 'pd')).toContain('rtt=pd')
    expect(routeLinks(points, 'mt')?.yandex).toContain('rtt=mt')
    expect(routeLinks(points, 'pd')?.google).toContain('travelmode=walking')
    expect(routeLinks(points, 'mt')?.google).toContain('travelmode=transit')
    expect(driving).not.toBeNull()
    if (!driving) {
      return
    }
    expect(externalLinkAttrs(driving.yandex)).toMatchObject({ target: '_blank', rel: expect.stringContaining('nofollow') })
    expect(externalLinkAttrs(driving.google)).toMatchObject({ target: '_blank', rel: expect.stringContaining('nofollow') })
  })

  it('skips a stop with no coordinates', () => {
    const stops = routeStopViews([
      { href: '/a', text: 'А', latitude: 54.6, longitude: 21 },
      { href: '/b', text: 'Б', latitude: null, longitude: null },
      { href: '/c', text: 'В', latitude: 54.7, longitude: 21.2 },
    ])
    expect(stops.map((stop) => stop.distanceLabel)).toEqual([null, null, null])
    expect(locatedStops(stops).map((point) => point.label)).toEqual(['1', '3'])
    const links = routeLinks(locatedStops(stops), 'auto')
    expect(links?.yandex).toBe('https://yandex.ru/maps/?rtext=54.60000,21.00000~54.70000,21.20000&rtt=auto')
    expect(links?.google).not.toContain('waypoints')
    expect(routeLinks([{ latitude: 1, longitude: 2 }], 'auto')).toBeNull()
    expect(formatStraightLine(12.2)).toBe('около 12 км по прямой')
    expect(formatStraightLine(0.476)).toBe('около 500 м по прямой')
  })

  it('labels short and long legs without changing stop order or inventing a final leg', () => {
    const input = [
      { href: '/a', text: 'А', latitude: 54.7, longitude: 20.5 },
      { href: '/b', text: 'Б', latitude: 54.704, longitude: 20.5 },
      { href: '/c', text: 'В', latitude: 54.9, longitude: 20.5 },
    ]
    const stops = routeStopViews(input)
    expect(stops.map((stop) => stop.href)).toEqual(input.map((stop) => stop.href))
    expect(stops.map((stop) => stop.distanceLabel)).toEqual([
      'около 450 м по прямой до следующей',
      'около 22 км по прямой до следующей',
      null,
    ])
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])('does not label an invalid distance %s', (distance) => {
    expect(formatStraightLine(distance)).toBe('')
  })
})
