import type { BasemapSpec } from './basemap'
import type { StyleVariant } from './variant'

/** Longitude, then latitude. */
export type LngLat = [number, number]

export interface MapCard {
  id: string
  title: string
  href: string
  kindLabel: string
  summary: string
  photo: string | null
  partner: boolean
  stale: boolean
  /** Icon key used when the card has no photo. */
  marker: string
  /** Stored venue phone. The host formats it for display. */
  phone?: string | null
}

export interface MapPointInput {
  id: string
  coordinates: LngLat
  marker: string
  title: string
  /** Draws the amber partner dot. The host decides when an offer is sponsored. */
  sponsored: boolean
  card: MapCard
}

export interface MapStopInput {
  id: string
  /** 1-based number drawn on the marker. */
  n: number
  coordinates: LngLat
  title: string
  card: MapCard
}

export interface PointsLayer {
  type: 'points'
  id: string
  cluster: boolean
  points: MapPointInput[]
}

export interface LineLayer {
  type: 'line'
  id: string
  coordinates: LngLat[]
  /** A dashed line is stop order, not a road. */
  dashed: boolean
}

export interface StopsLayer {
  type: 'stops'
  id: string
  stops: MapStopInput[]
}

export type MapLayer = PointsLayer | LineLayer | StopsLayer

export interface MapScene {
  variant: StyleVariant
  basemap: BasemapSpec
  /** Paint order, bottom to top. */
  layers: MapLayer[]
}

const LAYER_ID = /^[a-z][a-z0-9-]{0,40}$/

export function layerId(id: string) {
  if (!LAYER_ID.test(id)) {
    throw new Error(`Map layer id must match ${LAYER_ID}: ${id}`)
  }
  return id
}

export function pointsLayer(id: string, points: MapPointInput[], options?: { cluster?: boolean }): PointsLayer {
  return { type: 'points', id: layerId(id), cluster: options?.cluster !== false, points }
}

export function lineLayer(id: string, coordinates: LngLat[], options?: { dashed?: boolean }): LineLayer {
  return { type: 'line', id: layerId(id), coordinates, dashed: options?.dashed === true }
}

export function stopsLayer(id: string, stops: MapStopInput[]): StopsLayer {
  return { type: 'stops', id: layerId(id), stops }
}

export function mapScene(input: { variant: StyleVariant, basemap: BasemapSpec, layers: MapLayer[] }): MapScene {
  const seen = new Set<string>()
  for (const layer of input.layers) {
    if (seen.has(layer.id)) {
      throw new Error(`Duplicate map layer id: ${layer.id}`)
    }
    seen.add(layer.id)
  }
  return {
    variant: input.variant,
    basemap: input.basemap,
    layers: input.layers,
  }
}

export interface MapFeatureCollection {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    id?: string
    geometry: { type: 'Point', coordinates: LngLat } | { type: 'LineString', coordinates: LngLat[] }
    properties: Record<string, string | number>
  }>
}

const EMPTY: MapFeatureCollection = { type: 'FeatureCollection', features: [] }

export function layerCollection(layer: MapLayer): MapFeatureCollection {
  if (layer.type === 'points') {
    return {
      type: 'FeatureCollection',
      features: layer.points.map((point) => ({
        type: 'Feature',
        id: point.id,
        geometry: { type: 'Point', coordinates: point.coordinates },
        properties: {
          id: point.id,
          marker: point.marker,
          sponsored: point.sponsored ? 1 : 0,
          title: point.title,
        },
      })),
    }
  }
  if (layer.type === 'stops') {
    return {
      type: 'FeatureCollection',
      features: layer.stops.map((stop) => ({
        type: 'Feature',
        id: stop.id,
        geometry: { type: 'Point', coordinates: stop.coordinates },
        properties: { id: stop.id, n: stop.n, title: stop.title },
      })),
    }
  }
  if (layer.coordinates.length < 2) {
    return EMPTY
  }
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: layer.coordinates },
      properties: { dashed: layer.dashed ? 1 : 0 },
    }],
  }
}

export function cardFor(layers: readonly MapLayer[], id: string | null | undefined): MapCard | null {
  if (!id) {
    return null
  }
  for (const layer of layers) {
    if (layer.type === 'points') {
      const point = layer.points.find((item) => item.id === id)
      if (point) {
        return point.card
      }
    }
    if (layer.type === 'stops') {
      const stop = layer.stops.find((item) => item.id === id)
      if (stop) {
        return stop.card
      }
    }
  }
  return null
}

export function layerCoordinates(layers: readonly MapLayer[]): LngLat[] {
  const coords: LngLat[] = []
  for (const layer of layers) {
    if (layer.type === 'points') {
      coords.push(...layer.points.map((point) => point.coordinates))
    } else if (layer.type === 'stops') {
      coords.push(...layer.stops.map((stop) => stop.coordinates))
    } else {
      coords.push(...layer.coordinates)
    }
  }
  return coords
}

export function lonePoint(layers: readonly MapLayer[]): LngLat | null {
  const points = layers.filter((layer): layer is PointsLayer => layer.type === 'points').flatMap((layer) => layer.points)
  const stops = layers.filter((layer): layer is StopsLayer => layer.type === 'stops').flatMap((layer) => layer.stops)
  if (points.length === 1 && stops.length === 0) {
    return points[0]?.coordinates ?? null
  }
  return null
}
