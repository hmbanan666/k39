import { describe, expect, it } from 'vitest'
import {
  clusterPoints,
  MAP_STYLE_URL,
  mapDistanceLabel,
  parseMapQuery,
  pinButtonHtml,
  pinClassName,
  pinOffer,
  resolvedFrameHeight,
  WALKING_RADIUS_KM,
  yandexDestinationUrl,
} from '../shared/map'

describe('k39 map', () => {
  it('opens Yandex with the point as the destination', () => {
    expect(yandexDestinationUrl(54.656847, 20.567554)).toBe('https://yandex.ru/maps/?rtext=~54.65685,20.56755&rtt=auto')
    expect(yandexDestinationUrl(Number.NaN, 20)).toBe('')
  })

  it('gives the frame a real height when Leaflet would measure zero', () => {
    expect(resolvedFrameHeight(0, 320)).toBe(320)
    expect(resolvedFrameHeight(40, 420)).toBe(420)
    expect(resolvedFrameHeight(460, 320)).toBe(460)
  })

  it('clusters neighbours and leaves a distant pin alone', () => {
    const close = clusterPoints([
      { id: 'a', latitude: 54.71, longitude: 20.5 },
      { id: 'b', latitude: 54.71, longitude: 20.5 },
    ], 14)
    expect(close).toHaveLength(1)
    expect(close[0]?.points).toHaveLength(2)
    const apart = clusterPoints([
      { id: 'a', latitude: 54.71, longitude: 20.5 },
      { id: 'b', latitude: 55.2, longitude: 22.1 },
    ], 16)
    expect(apart).toHaveLength(2)
    expect(clusterPoints([], 10)).toEqual([])
  })

  it('hides the partner label unless the flag and an offer are both set', () => {
    const offer = { partner: true, offer: 'Обед со скидкой' }
    expect(pinOffer(offer, false)).toEqual({ partner: false, offer: null })
    expect(pinOffer({ partner: true, offer: '  ' }, true)).toEqual({ partner: false, offer: null })
    expect(pinOffer(offer, true)).toEqual({ partner: true, offer: 'Обед со скидкой' })
  })

  it('builds a pin button and keeps the walking distance off the focus point', () => {
    const html = pinButtonHtml({
      title: 'Форт <11>',
      label: '1',
      layer: 'route',
      kind: 'fort',
      partner: false,
      focus: true,
    })
    expect(html).toContain('aria-label="Форт &lt;11&gt;"')
    expect(html).toContain('>1<')
    expect(pinClassName({ layer: 'venue', kind: 'coffee', partner: true, focus: false })).toContain('k39-pin-partner')
    expect(mapDistanceLabel(0)).toBe('')
    expect(mapDistanceLabel(0.4)).toContain('м')
    expect(WALKING_RADIUS_KM).toBe(1.2)
  })

  it('parses a nearby query and a catalog, and credits the tile sources', () => {
    expect(parseMapQuery({ lat: '54.7', lng: '20.5', route: '' })).toMatchObject({
      scope: 'nearby',
      latitude: 54.7,
      longitude: 20.5,
      radiusKm: 1.2,
    })
    expect(parseMapQuery({ scope: 'catalog', lat: '54.7', lng: '20.5' }).scope).toBe('catalog')
    expect(parseMapQuery({ route: 'vostochnye-zamki' })).toMatchObject({ scope: 'nearby', route: 'vostochnye-zamki' })
    expect(parseMapQuery({ route: '../etc' }).route).toBe('')
    expect(parseMapQuery({ radius: '40' }).radiusKm).toBe(8)
    expect(parseMapQuery({ lat: '54.7', lng: '20.5', radius: '' }).radiusKm).toBe(1.2)
    expect(MAP_STYLE_URL).toBe('https://tiles.openfreemap.org/styles/positron')
  })
})
