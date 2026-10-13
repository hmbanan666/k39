import { describe, expect, it } from 'vitest'
import { basemapFromUrl, cardFor, layerCollection, layerId, lineLayer, lonePoint, mapScene, mapStyle, pointsLayer, stopsLayer } from '../src/index'

const card = {
  id: 'a',
  title: 'Форт',
  href: '/fort',
  kindLabel: 'Форты',
  summary: '',
  photo: null,
  partner: false,
  stale: false,
  marker: 'forty',
}

describe('map layers', () => {
  it('builds points, a dashed line, numbered stops, and a sponsored pin', () => {
    const points = pointsLayer('places', [{
      id: 'a',
      coordinates: [20.5, 54.7],
      marker: 'forty',
      title: 'Форт',
      sponsored: true,
      card,
    }])
    const line = lineLayer('route', [[20.5, 54.7], [20.6, 54.8]], { dashed: true })
    const stops = stopsLayer('route-stops', [{
      id: 'stop:a',
      n: 1,
      coordinates: [20.5, 54.7],
      title: 'Форт',
      card: { ...card, id: 'stop:a', kindLabel: 'Остановка 1' },
    }])
    const scene = mapScene({ variant: 'paper', basemap: basemapFromUrl(''), layers: [line, points, stops] })
    expect(scene.layers.map((layer) => layer.id)).toEqual(['route', 'places', 'route-stops'])
    expect(layerCollection(points).features[0]?.properties.sponsored).toBe(1)
    expect(layerCollection(line).features[0]?.properties.dashed).toBe(1)
    expect(layerCollection(stops).features[0]?.properties.n).toBe(1)
    expect(layerCollection(lineLayer('short', [[20, 54]])).features).toEqual([])
    expect(cardFor(scene.layers, 'stop:a')?.kindLabel).toBe('Остановка 1')
    expect(cardFor(scene.layers, 'missing')).toBeNull()
    expect(lonePoint([points])).toEqual([20.5, 54.7])
    expect(lonePoint(scene.layers)).toBeNull()
  })

  it('rejects a bad or repeated layer id', () => {
    expect(() => layerId('Places')).toThrow(/layer id/)
    expect(() => mapScene({
      variant: 'paper',
      basemap: {},
      layers: [pointsLayer('places', []), pointsLayer('places', [])],
    })).toThrow(/Duplicate/)
  })

  it('keeps the paper style on OpenFreeMap until an archive URL is set', () => {
    const open = mapStyle('paper', {})
    expect(JSON.stringify(open.sources)).toContain('openfreemap.org')
    const hosted = mapStyle('paper', { pmtilesUrl: '/basemap/kaliningrad.pmtiles', origin: 'https://k39.online' })
    expect(JSON.stringify(hosted.sources)).toContain('pmtiles:///basemap/kaliningrad.pmtiles')
    expect(hosted).toHaveProperty('sprite', 'https://k39.online/basemap/sprites/k39')
  })
})
