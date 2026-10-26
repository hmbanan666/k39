import type { MapPoint, MapRoute } from '../shared/map'
import { mapStyle } from '@k39/map'
import { describe, expect, it } from 'vitest'
import {
  activeCategory,
  blurb,
  browseCounts,
  browseList,
  curatedSights,
  facetCounts,
  focusMatch,
  foodIdsIn,
  formatDistance,
  isChurchPlace,
  mapFocusHref,
  mapQueryRecord,
  normalizeRoutePath,
  parseMapQuery,
  partnerVisible,
  pointInCategory,
  pointVisible,
  routeDurationLabel,
  routeOverlay,
  shownPoints,
  sortMapPoints,
  stopsLabel,
  toggleId,
  visitorLayers,
} from '../shared/map'

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
    expect(state).toEqual({ sights: null, food: null, route: null, q: '', category: null, focus: null })
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
    expect(
      pointVisible(cathedral, { sights: ['muzei'], food: null, route: null, q: '', category: null, focus: null }),
    ).toBe(true)
    expect(
      pointVisible(cathedral, { sights: ['tserkvi'], food: null, route: null, q: '', category: null, focus: null }),
    ).toBe(true)
    expect(
      pointVisible(cathedral, { sights: ['forty'], food: null, route: null, q: '', category: null, focus: null }),
    ).toBe(false)
    expect(pointVisible(fort, { sights: [], food: null, route: null, q: '', category: null, focus: null })).toBe(false)
  })

  it('round-trips sight, food, route, and search query keys', () => {
    const state = parseMapQuery({ s: 'forty,zamki', f: 'kofe,pekarnya', r: 'pyat-fortov', q: '  форт  ' })
    expect(state.sights).toEqual(['forty', 'zamki'])
    expect(state.food).toEqual(['coffee', 'bakery'])
    expect(state.route).toBe('pyat-fortov')
    expect(state.q).toBe('форт')
    expect(mapQueryRecord(state)).toEqual({ s: 'forty,zamki', f: 'kofe,pekarnya', r: 'pyat-fortov', q: 'форт' })
    expect(parseMapQuery({ s: 'none', f: 'none' })).toMatchObject({ sights: [], food: [] })
    expect(mapQueryRecord({ sights: [], food: [], route: null, q: '', category: null, focus: null })).toEqual({
      s: 'none',
      f: 'none',
    })
    expect(mapQueryRecord({ sights: null, food: null, route: null, q: '', category: 'food', focus: null })).toEqual({
      c: 'food',
    })
    expect(parseMapQuery({ c: 'beaches' }).category).toBe('beaches')
    expect(parseMapQuery({ c: 'nope' }).category).toBeNull()
    expect(parseMapQuery({ focus: '/zavedeniya/kofe' }).focus).toBe('zavedeniya/kofe')
    expect(mapFocusHref('/zavedeniya/kofe')).toBe('/map?focus=zavedeniya%2Fkofe')
    expect(focusMatch(coffee, 'kofe')).toBe(true)
    expect(shownPoints(points, { ...parseMapQuery({}), focus: 'kofe' }).some((item) => item.id === 'kofe')).toBe(true)
    expect(pointVisible(coffee, { ...state, sights: null, food: state.food, q: '' })).toBe(true)
    expect(pointVisible(fort, { sights: null, food: null, route: null, q: 'кофе', category: null })).toBe(false)
    expect(
      pointVisible(coffee, { sights: null, food: ['restaurant'], route: null, q: '', category: null, focus: null }),
    ).toBe(false)
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
    expect(dashed?.line).toEqual([
      [20.5, 54.7],
      [20.6, 54.8],
    ])
    expect(dashed?.stops.map((stop) => stop.position)).toEqual([1, 2])
    const solid = routeOverlay({
      ...route,
      path: [
        [20.5, 54.7],
        [20.55, 54.75],
        [20.6, 54.8],
      ],
    })
    expect(solid?.dashed).toBe(false)
    expect(solid?.line).toHaveLength(3)
    expect(routeOverlay({ ...route, path: [[200, 54]] })?.dashed).toBe(true)
    expect(normalizeRoutePath([[20, 54]])).toBeNull()
    const first = route.stops[0]
    expect(routeOverlay({ ...route, stops: first ? [first] : [] })?.line).toBeNull()
  })
})

describe('visitor layers', () => {
  it('builds a clustered point layer and a dashed route only when one is selected', () => {
    const quiet = visitorLayers([fort, coffee], null)
    expect(quiet.map((layer) => layer.type)).toEqual(['points'])
    expect(quiet[0]?.type === 'points' && quiet[0].points.find((point) => point.id === 'kofe')?.sponsored).toBe(true)
    const layers = visitorLayers([fort, coffee], {
      dashed: true,
      line: [
        [20.5, 54.7],
        [20.6, 54.8],
      ],
      stops: [
        {
          position: 1,
          title: 'Один',
          href: '/fort',
          latitude: 54.7,
          longitude: 20.5,
          summary: '',
          photo: null,
          id: 'stop:/fort',
        },
        {
          position: 2,
          title: 'Два',
          href: '/b',
          latitude: 54.8,
          longitude: 20.6,
          summary: '',
          photo: null,
          id: 'stop:/b',
        },
      ],
    })
    expect(layers.map((layer) => layer.id)).toEqual(['route', 'places', 'route-stops'])
    expect(layers[0]).toMatchObject({ type: 'line', dashed: true })
    expect(layers[1]?.type === 'points' && layers[1].points.some((point) => point.id === 'fort')).toBe(false)
  })
})

describe('browse panel', () => {
  const beach = point({
    id: 'beach',
    title: 'Пляж',
    group: 'sight',
    category: 'plyazhi',
    marker: 'plyazhi',
    latitude: 55.1,
    longitude: 21.2,
  })
  const points = [fort, cathedral, coffee, beach]
  const idle = { sights: null, food: null, route: null, q: '', category: null, focus: null }

  it('keeps the idle map to a short curated shelf', () => {
    const shown = shownPoints(points, idle)
    expect(shown.map((item) => item.id)).not.toContain('kofe')
    expect(shown.length).toBeLessThanOrEqual(6)
    expect(curatedSights(points).some((item) => item.category === 'plyazhi')).toBe(true)
    expect(activeCategory(idle)).toBeNull()
    expect(activeCategory({ ...idle, category: 'routes' })).toBe('routes')
    expect(activeCategory({ ...idle, sights: ['forty'] })).toBe('sights')
  })

  it('hides empty categories and lists only what is inside the view', () => {
    expect(browseCounts(points, 1)).toMatchObject({ sights: 2, food: 1, beaches: 1, routes: 1 })
    expect(browseCounts([fort], 0).beaches).toBe(0)
    expect(pointInCategory(beach, 'sights')).toBe(false)
    expect(pointInCategory(beach, 'beaches')).toBe(true)
    expect(pointInCategory(cathedral, 'sights', { ...idle, sights: ['tserkvi'] })).toBe(true)
    const box = { west: 20.4, south: 54.6, east: 20.6, north: 54.75 }
    const list = browseList(points, box, { latitude: 54.7, longitude: 20.5 })
    expect(list.items.map((item) => item.id)).toEqual(['kofe', 'sobor', 'fort'])
    expect(list.nearby).toBe(false)
    const nearby = browseList(
      [{ ...beach, latitude: 55.2, longitude: 20.9 }],
      box,
      { latitude: 54.7, longitude: 20.5 },
      'пляж',
    )
    expect(nearby.nearby).toBe(true)
    expect(nearby.items).toHaveLength(1)
    expect(formatDistance(0.4)).toBe('400 м по прямой')
    expect(formatDistance(2.5)).toBe('2,5 км по прямой')
    expect(stopsLabel(1)).toBe('1 остановка')
    expect(stopsLabel(2)).toBe('2 остановки')
    expect(stopsLabel(5)).toBe('5 остановок')
  })

  it('estimates a route duration from the stop spacing', () => {
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
    expect(routeDurationLabel(route)).toMatch(/^около \d+ мин$/)
    expect(shownPoints(points, { ...idle, category: 'food' }).map((item) => item.id)).toEqual(['kofe'])
    expect(shownPoints(points, { ...idle, category: 'routes' })).toEqual([])
  })
})

describe('basemap style', () => {
  it('keeps OpenFreeMap when no archive URL is set', () => {
    const style = mapStyle('paper', {})
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
    const style = mapStyle('paper', { pmtilesUrl: '/basemap/kaliningrad.pmtiles', origin: 'https://k39.online' })
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
