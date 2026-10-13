import type { MapFeatureCollection, MapLayer } from '@k39/map'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import { layerCollection } from '@k39/map'

const EMPTY: MapFeatureCollection = { type: 'FeatureCollection', features: [] }

type GeoJsonData = Parameters<GeoJSONSource['setData']>[0]

function asGeoJson(data: MapFeatureCollection): GeoJsonData {
  return data as GeoJsonData
}

function sourceOf(map: MapLibreMap, id: string) {
  const source = map.getSource(id)
  if (!source || source.type !== 'geojson') {
    return null
  }
  return source as GeoJSONSource
}

function drawPoints(layer: Extract<MapLayer, { type: 'points' }>, known: Set<string>): MapFeatureCollection {
  const data = layerCollection(layer)
  for (const feature of data.features) {
    const marker = String(feature.properties.marker || '')
    if (!known.has(marker)) {
      feature.properties.marker = 'other'
    }
  }
  return data
}

export function layerPaintIds(layer: Pick<MapLayer, 'id' | 'type'>) {
  if (layer.type === 'points') {
    return [`${layer.id}-clusters`, `${layer.id}-cluster-count`, `${layer.id}-halo`, `${layer.id}-pins`, `${layer.id}-sponsored`]
  }
  if (layer.type === 'line') {
    return [`${layer.id}-solid`, `${layer.id}-dashed`]
  }
  return [`${layer.id}-halo`, `${layer.id}-stops`]
}

export function interactivePaintIds(layer: MapLayer) {
  if (layer.type === 'points') {
    return layer.cluster
      ? [`${layer.id}-clusters`, `${layer.id}-pins`]
      : [`${layer.id}-pins`]
  }
  if (layer.type === 'stops') {
    return [`${layer.id}-stops`]
  }
  return []
}

export function eraseMapLayer(map: MapLibreMap, layer: Pick<MapLayer, 'id' | 'type'>) {
  for (const id of [...layerPaintIds(layer)].reverse()) {
    if (map.getLayer(id)) {
      map.removeLayer(id)
    }
  }
  if (map.getSource(layer.id)) {
    map.removeSource(layer.id)
  }
}

export function paintMapLayer(map: MapLibreMap, layer: MapLayer, known: Set<string>) {
  if (layer.type === 'points') {
    map.addSource(layer.id, {
      type: 'geojson',
      data: asGeoJson(drawPoints(layer, known)),
      cluster: layer.cluster,
      clusterRadius: 48,
      clusterMaxZoom: 13,
    })
    if (layer.cluster) {
      map.addLayer({
        id: `${layer.id}-clusters`,
        type: 'circle',
        source: layer.id,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#fffbf3',
          'circle-stroke-color': '#a3402a',
          'circle-stroke-width': 2,
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 30, 24],
        },
      })
      map.addLayer({
        id: `${layer.id}-cluster-count`,
        type: 'symbol',
        source: layer.id,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 13,
        },
        paint: { 'text-color': '#2b2420' },
      })
    }
    map.addLayer({
      id: `${layer.id}-halo`,
      type: 'circle',
      source: layer.id,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          20,
          ['boolean', ['feature-state', 'hover'], false],
          16,
          0,
        ],
        'circle-color': '#a3402a',
        'circle-opacity': 0.22,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fffbf3',
        'circle-translate': [0, -16],
      },
    })
    map.addLayer({
      id: `${layer.id}-pins`,
      type: 'symbol',
      source: layer.id,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': ['get', 'marker'],
        'icon-anchor': 'bottom',
        'icon-allow-overlap': true,
        'icon-size': 1,
      },
    })
    map.addLayer({
      id: `${layer.id}-sponsored`,
      type: 'circle',
      source: layer.id,
      filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'sponsored'], 1]],
      paint: {
        'circle-color': '#d68a22',
        'circle-stroke-color': '#fffbf3',
        'circle-stroke-width': 1.5,
        'circle-radius': 4.5,
        'circle-translate': [11, -30],
      },
    })
    return
  }
  if (layer.type === 'line') {
    map.addSource(layer.id, { type: 'geojson', data: asGeoJson(layerCollection(layer)) })
    map.addLayer({
      id: `${layer.id}-solid`,
      type: 'line',
      source: layer.id,
      filter: ['==', ['get', 'dashed'], 0],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#a3402a', 'line-width': 3, 'line-opacity': 0.9 },
    })
    map.addLayer({
      id: `${layer.id}-dashed`,
      type: 'line',
      source: layer.id,
      filter: ['==', ['get', 'dashed'], 1],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#a3402a',
        'line-width': 2.5,
        'line-opacity': 0.75,
        'line-dasharray': [1.2, 1.15],
      },
    })
    return
  }
  map.addSource(layer.id, { type: 'geojson', data: asGeoJson(layerCollection(layer)) })
  map.addLayer({
    id: `${layer.id}-halo`,
    type: 'circle',
    source: layer.id,
    paint: {
      'circle-radius': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        18,
        ['boolean', ['feature-state', 'hover'], false],
        15,
        0,
      ],
      'circle-color': '#a3402a',
      'circle-opacity': 0.2,
    },
  })
  map.addLayer({
    id: `${layer.id}-stops`,
    type: 'symbol',
    source: layer.id,
    layout: {
      'icon-image': 'stop',
      'icon-anchor': 'center',
      'icon-allow-overlap': true,
      'text-field': ['to-string', ['get', 'n']],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
      'text-allow-overlap': true,
      'icon-size': 1,
    },
    paint: { 'text-color': '#fffbf3' },
  })
}

export function replaceMapLayerData(map: MapLibreMap, layer: MapLayer, known: Set<string>) {
  const source = sourceOf(map, layer.id)
  if (!source) {
    return false
  }
  const data = layer.type === 'points' ? drawPoints(layer, known) : layerCollection(layer)
  source.setData(asGeoJson(data.features.length ? data : EMPTY))
  return true
}

export { EMPTY }
