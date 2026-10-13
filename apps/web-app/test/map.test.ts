import type { MapPoint, MapRoute } from '../shared/map'
import { describe, expect, it } from 'vitest'
import {
  blurb,
  facetCounts,
  foodIdsIn,
  isChurchPlace,

  mapQueryRecord,
  normalizeRoutePath,
  parseMapQuery,
  partnerVisible,
  pointVisible,
  routeOverlay,
  sortMapPoints,
  toggleId,
} from '../shared/map'
import { k39MapStyle } from '../shared/map-style'

function point(partial: Partial<MapPoint> & Pick<MapPoint, 'id' | 'title' | 'group' | 'category'>): MapPoint {
  return {
    slug: partial.id,
    href: `/${partial.id}`,
    latitude: 54.7,
    longitude: 20.5,
    marker: partial.category,
    church: false,
    kindLabel: partial.category,
    summary: '',
    photo: null,
    partner: false,
    stale: false,
    ...partial,
  }
}

const fort = point({ id: 'fort', title: 'Форт № 1', group: 'sight', category: 'forty', marker: 'forty' })
const cathedral = point({
  id: 'sobor',
  title: 'Кафедральный собор',
  group: 'sight',
  category: 'muzei',
  marker: 'tserkvi',
  church: true,
  kindLabel: 'Церкви',
})
const coffee = point({
  id: 'kofe',
  title: 'Кофе у ворот',
  group: 'food',
  category: 'coffee',
  marker: 'coffee',
  kindLabel: 'Кофейни',
  partner: true,
})

describe('map filters', () => {
  const points = [fort, cathedral, coffee]

  it('treats an empty query as every sight and every food kind, with routes off', () => {
    const state = parseMapQuery({})
    expect(state).toEqual({ sights: null, food: null, route: null, q: '' })
    expect(mapQueryRecord(state)).toEqual({})
    expect(points.filter((item) => pointVisible(item, state)).map((item) => item.id)).toEqual(['fort', 'sobor', 'kofe'])
    expect(routeOverlay(null)).toBeNull()
  })

  it('keeps churches on the museum chip and on their own chip', () => {
    expect(isChurchPlace('kafedralnyi-sobor', 'Кафедральный собор')).toBe(true)
    expect(isChurchPlace('fort-1-shtayn', 'Форт № 1 Штайн')).toBe(false)
    const counts = facetCounts(points)
    expect(counts.sights.forty).toBe(1)
    expect(counts.sights.muzei).toBe(1)
    expect(counts.sights.tserkvi).toBe(1)
    expect(counts.food.coffee).toBe(1)
    expect(pointVisible(cathedral, { sights: ['muzei'], food: null, route: null, q: '' })).toBe(true)
    expect(pointVisible(cathedral, { sights: ['tserkvi'], food: null, route: null, q: '' })).toBe(true)
    expect(pointVisible(cathedral, { sights: ['forty'], food: null, route: null, q: '' })).toBe(false)
    expect(pointVisible(fort, { sights: [], food: null, route: null, q: '' })).toBe(false)
  })

  it('round-trips sight, food, route, and search query keys', () => {
    const state = parseMapQuery({ s: 'forty,zamki', f: 'kofe,pekarnya', r: 'pyat-fortov', q: '  форт  ' })
    expect(state.sights).toEqual(['forty', 'zamki'])
    expect(state.food).toEqual(['coffee', 'bakery'])
    expect(state.route).toBe('pyat-fortov')
    expect(state.q).toBe('форт')
    expect(mapQueryRecord(state)).toEqual({ s: 'forty,zamki', f: 'kofe,pekarnya', r: 'pyat-fortov', q: 'форт' })
    expect(parseMapQuery({ s: 'none', f: 'none' })).toMatchObject({ sights: [], food: [] })
    expect(mapQueryRecord({ sights: [], food: [], route: null, q: '' })).toEqual({ s: 'none', f: 'none' })
    expect(pointVisible(coffee, { ...state, sights: null, food: state.food, q: '' })).toBe(true)
    expect(pointVisible(fort, { sights: null, food: null, route: null, q: 'кофе' })).toBe(false)
    expect(pointVisible(coffee, { sights: null, food: ['restaurant'], route: null, q: '' })).toBe(false)
  })

  it('drops one chip from the full set and sorts a partner first', () => {
    const next = toggleId(null, 'forty', ['forty', 'zamki'])
    expect(next).toEqual(['zamki'])
    expect(toggleId(['zamki'], 'forty', ['forty', 'zamki'])).toBeNull()
    expect(foodIdsIn(points)).not.toContain('eda')
    expect(sortMapPoints([fort, coffee]).map((item) => item.id)).toEqual(['kofe', 'fort'])
    expect(partnerVisible(false, true)).toBe(false)
    expect(partnerVisible(true, true)).toBe(true)
    expect(blurb('слово '.repeat(40), 20).endsWith('...')).toBe(true)
  })
})

describe('route geometry', () => {
  const route: MapRoute = {
    slug: 'pyat-fortov',
    title: 'Пять фортов',
    href: '/marshruty/pyat-fortov',
    path: null,
    stops: [
      { position: 1, title: 'Один', href: '/a', latitude: 54.7, longitude: 20.5, summary: '', photo: null },
      { position: 2, title: 'Два', href: '/b', latitude: 54.8, longitude: 20.6, summary: '', photo: null },
    ],
  }

  it('uses a dashed connector until a real line is stored', () => {
    const dashed = routeOverlay(route)
    expect(dashed?.dashed).toBe(true)
    expect(dashed?.line).toEqual([[20.5, 54.7], [20.6, 54.8]])
    expect(dashed?.stops.map((stop) => stop.position)).toEqual([1, 2])
    const solid = routeOverlay({ ...route, path: [[20.5, 54.7], [20.55, 54.75], [20.6, 54.8]] })
    expect(solid?.dashed).toBe(false)
    expect(solid?.line).toHaveLength(3)
    expect(routeOverlay({ ...route, path: [[200, 54]] })?.dashed).toBe(true)
    expect(normalizeRoutePath([[20, 54]])).toBeNull()
    const first = route.stops[0]
    expect(routeOverlay({ ...route, stops: first ? [first] : [] })?.line).toBeNull()
  })
})

describe('basemap style', () => {
  it('keeps OpenFreeMap when no archive URL is set', () => {
    const style = k39MapStyle()
    const layers = style.layers as Array<Record<string, unknown>>
    const background = layers.find((layer) => layer.id === 'background') as { paint: { 'background-color': string } }
    const water = layers.find((layer) => layer.id === 'water') as { paint: { 'fill-color': string } }
    expect(background.paint['background-color']).toBe('#efe6d4')
    expect(water.paint['fill-color']).toBe('#c5d4d8')
    expect(layers.some((layer) => layer['source-layer'] === 'poi' || layer['source-layer'] === 'pois')).toBe(false)
    expect(JSON.stringify(style.sources)).toContain('openstreetmap.org/copyright')
    expect(JSON.stringify(style.sources)).toContain('openfreemap.org')
    const town = layers.find((layer) => layer.id === 'label-town') as { layout: { 'text-field': unknown } }
    expect(JSON.stringify(town.layout['text-field'])).toContain('name:ru')
    expect(style.glyphs).toContain('tiles.openfreemap.org/fonts')
  })

  it('points a self-hosted archive at PMTiles, local glyphs, and Protomaps layers', () => {
    const style = k39MapStyle({ pmtilesUrl: '/basemap/kaliningrad.pmtiles', origin: 'https://k39.online' })
    const layers = style.layers as Array<Record<string, unknown>>
    expect(style.glyphs).toBe('/basemap/fonts/{fontstack}/{range}.pbf')
    expect(style.sprite).toBe('https://k39.online/basemap/sprites/k39')
    const encoded = JSON.stringify(style.sources)
    expect(encoded).toContain('pmtiles:///basemap/kaliningrad.pmtiles')
    expect(encoded).toContain('protomaps.com')
    expect(encoded).toContain('OpenStreetMap contributors')
    expect(encoded).not.toContain('openfreemap.org')
    expect(layers.some((layer) => layer['source-layer'] === 'roads')).toBe(true)
    expect(layers.some((layer) => layer['source-layer'] === 'pois' || layer['source-layer'] === 'poi')).toBe(false)
    const water = layers.find((layer) => layer.id === 'water') as { paint: { 'fill-color': string } }
    expect(water.paint['fill-color']).toBe('#c5d4d8')
    const town = layers.find((layer) => layer.id === 'label-town') as { layout: { 'text-field': unknown } }
    expect(JSON.stringify(town.layout['text-field'])).toContain('name:ru')
  })
})
