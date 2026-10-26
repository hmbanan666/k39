import { describe, expect, it } from 'vitest'
import { mapDistanceLabel, parseMapQuery, pinOffer, WALKING_RADIUS_KM, yandexDestinationUrl } from '../shared/embed-map'

describe('k39 map', () => {
  it('opens Yandex with the point as the destination', () => {
    expect(yandexDestinationUrl(54.656847, 20.567554)).toBe('https://yandex.ru/maps/?rtext=~54.65685,20.56755&rtt=auto')
    expect(yandexDestinationUrl(Number.NaN, 20)).toBe('')
  })

  it('hides the partner label unless the flag and an offer are both set', () => {
    const offer = { partner: true, offer: 'Обед со скидкой' }
    expect(pinOffer(offer, false)).toEqual({ partner: false, offer: null })
    expect(pinOffer({ partner: true, offer: '  ' }, true)).toEqual({ partner: false, offer: null })
    expect(pinOffer(offer, true)).toEqual({ partner: true, offer: 'Обед со скидкой' })
  })

  it('labels straight-line distances and keeps the focus threshold', () => {
    expect(mapDistanceLabel(0)).toBe('')
    expect(mapDistanceLabel(0.049)).toBe('')
    expect(mapDistanceLabel(null)).toBe('')
    expect(mapDistanceLabel(Number.NaN)).toBe('')
    expect(mapDistanceLabel(0.4)).toBe('около 400 м по прямой')
    expect(mapDistanceLabel(12.2)).toBe('12 км по прямой')
    expect(WALKING_RADIUS_KM).toBe(1.2)
  })

  it('parses a nearby query and a catalog', () => {
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
  })
})
