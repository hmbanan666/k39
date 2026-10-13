import { BASEMAP_GLYPHS, BASEMAP_SPRITE, MAP_ATTRIBUTION, MAP_ATTRIBUTION_PMTILES, pmtilesSourceUrl } from './map'

const LAND = '#efe6d4'
const WATER = '#c5d4d8'
const INK = '#2b2420'
const MUTED = '#6a5d52'
const HALO = '#f5eee1'
const FONT = ['Noto Sans Regular']
const FONT_BOLD = ['Noto Sans Bold']

const PLACE_NAME = ['coalesce', ['get', 'name:ru'], ['get', 'name']]

function roadFilter(classes: string[]) {
  return [
    'all',
    ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
    ['!=', ['get', 'brunnel'], 'tunnel'],
    ['match', ['get', 'class'], classes, true, false],
  ]
}

function lineWidth(stops: number[]) {
  return ['interpolate', ['exponential', 1.2], ['zoom'], ...stops]
}

function placeLabel(id: string, placeClass: string, minzoom: number, size: number[], font: string[], color: string) {
  return {
    id,
    'type': 'symbol',
    'source': 'openmaptiles',
    'source-layer': 'place',
    minzoom,
    'filter': ['==', ['get', 'class'], placeClass],
    'layout': {
      'text-field': PLACE_NAME,
      'text-font': font,
      'text-size': ['interpolate', ['linear'], ['zoom'], ...size],
      'text-max-width': 8,
      'text-padding': 4,
    },
    'paint': {
      'text-color': color,
      'text-halo-color': HALO,
      'text-halo-width': 1.3,
      'text-halo-blur': 0.4,
    },
  }
}

function openFreeMapStyle() {
  return {
    version: 8,
    name: 'K39',
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
        attribution: MAP_ATTRIBUTION,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': LAND } },
      {
        'id': 'landcover-wood',
        'type': 'fill',
        'source': 'openmaptiles',
        'source-layer': 'landcover',
        'filter': ['==', ['get', 'class'], 'wood'],
        'paint': { 'fill-color': '#d5e0d2', 'fill-opacity': 0.7 },
      },
      {
        'id': 'landcover-grass',
        'type': 'fill',
        'source': 'openmaptiles',
        'source-layer': 'landcover',
        'filter': ['==', ['get', 'class'], 'grass'],
        'paint': { 'fill-color': '#e3ebdc', 'fill-opacity': 0.55 },
      },
      {
        'id': 'landcover-sand',
        'type': 'fill',
        'source': 'openmaptiles',
        'source-layer': 'landcover',
        'filter': ['match', ['get', 'class'], ['sand', 'farmland'], true, false],
        'paint': { 'fill-color': '#eadfca', 'fill-opacity': 0.45 },
      },
      {
        'id': 'landuse-residential',
        'type': 'fill',
        'source': 'openmaptiles',
        'source-layer': 'landuse',
        'filter': ['==', ['get', 'class'], 'residential'],
        'paint': { 'fill-color': '#e7dcc8', 'fill-opacity': 0.35 },
      },
      {
        'id': 'park',
        'type': 'fill',
        'source': 'openmaptiles',
        'source-layer': 'park',
        'paint': { 'fill-color': '#d7e3d4', 'fill-opacity': 0.55 },
      },
      {
        'id': 'water',
        'type': 'fill',
        'source': 'openmaptiles',
        'source-layer': 'water',
        'filter': ['!=', ['get', 'brunnel'], 'tunnel'],
        'paint': { 'fill-color': WATER },
      },
      {
        'id': 'waterway',
        'type': 'line',
        'source': 'openmaptiles',
        'source-layer': 'waterway',
        'filter': ['!=', ['get', 'brunnel'], 'tunnel'],
        'paint': {
          'line-color': '#b7c9cf',
          'line-width': lineWidth([8, 0.4, 14, 2.2]),
        },
      },
      {
        'id': 'road-minor',
        'type': 'line',
        'source': 'openmaptiles',
        'source-layer': 'transportation',
        'minzoom': 12,
        'filter': roadFilter(['minor', 'service']),
        'layout': { 'line-cap': 'round', 'line-join': 'round' },
        'paint': {
          'line-color': '#f4eee4',
          'line-width': lineWidth([12, 0.2, 14, 1.4, 17, 6]),
        },
      },
      {
        'id': 'road-secondary',
        'type': 'line',
        'source': 'openmaptiles',
        'source-layer': 'transportation',
        'filter': roadFilter(['secondary', 'tertiary']),
        'layout': { 'line-cap': 'round', 'line-join': 'round' },
        'paint': {
          'line-color': '#eadcc8',
          'line-width': lineWidth([8, 0.4, 13, 2.2, 17, 8]),
        },
      },
      {
        'id': 'road-primary',
        'type': 'line',
        'source': 'openmaptiles',
        'source-layer': 'transportation',
        'filter': roadFilter(['primary', 'trunk']),
        'layout': { 'line-cap': 'round', 'line-join': 'round' },
        'paint': {
          'line-color': '#e2d0b4',
          'line-width': lineWidth([6, 0.5, 12, 2.6, 17, 10]),
        },
      },
      {
        'id': 'road-motorway',
        'type': 'line',
        'source': 'openmaptiles',
        'source-layer': 'transportation',
        'filter': roadFilter(['motorway']),
        'layout': { 'line-cap': 'round', 'line-join': 'round' },
        'paint': {
          'line-color': '#d7c2a4',
          'line-width': lineWidth([6, 0.6, 12, 3, 17, 11]),
        },
      },
      {
        'id': 'building',
        'type': 'fill',
        'source': 'openmaptiles',
        'source-layer': 'building',
        'minzoom': 14,
        'paint': { 'fill-color': '#e6dccb', 'fill-outline-color': '#d9cbb6' },
      },
      {
        'id': 'boundary',
        'type': 'line',
        'source': 'openmaptiles',
        'source-layer': 'boundary',
        'filter': ['all', ['match', ['get', 'admin_level'], [2, 4], true, false], ['!=', ['get', 'maritime'], 1]],
        'paint': {
          'line-color': '#c4b6a4',
          'line-width': 0.8,
          'line-opacity': 0.55,
          'line-dasharray': [2, 1.5],
        },
      },
      placeLabel('label-city', 'city', 4, [5, 13, 10, 18], FONT_BOLD, INK),
      placeLabel('label-town', 'town', 7, [7, 12, 12, 15], FONT, INK),
      placeLabel('label-village', 'village', 11, [11, 11, 14, 13], FONT, MUTED),
      {
        'id': 'water-name',
        'type': 'symbol',
        'source': 'openmaptiles',
        'source-layer': 'water_name',
        'minzoom': 12,
        'layout': {
          'text-field': PLACE_NAME,
          'text-font': FONT,
          'text-size': 11,
          'text-max-width': 6,
        },
        'paint': {
          'text-color': '#5d7380',
          'text-halo-color': HALO,
          'text-halo-width': 1,
        },
      },
    ],
  }
}

const LOCAL_NAME = ['coalesce', ['get', 'name:ru'], ['get', 'name']]

function polygon(types = ['Polygon', 'MultiPolygon']) {
  return ['match', ['geometry-type'], types, true, false]
}

function lineGeom() {
  return ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false]
}

function protomapsPlace(id: string, detail: string | string[], minzoom: number, size: number[], font: string[], color: string) {
  const details = Array.isArray(detail) ? detail : [detail]
  return {
    id,
    'type': 'symbol',
    'source': 'basemap',
    'source-layer': 'places',
    minzoom,
    'filter': ['all', ['==', ['get', 'kind'], 'locality'], ['match', ['get', 'kind_detail'], details, true, false]],
    'layout': {
      'text-field': LOCAL_NAME,
      'text-font': font,
      'text-size': ['interpolate', ['linear'], ['zoom'], ...size],
      'text-max-width': 8,
      'text-padding': 4,
    },
    'paint': {
      'text-color': color,
      'text-halo-color': HALO,
      'text-halo-width': 1.3,
      'text-halo-blur': 0.4,
    },
  }
}

function protomapsStyle(pmtilesUrl: string, origin?: string) {
  const sprite = origin ? `${origin.replace(/\/$/, '')}${BASEMAP_SPRITE}` : BASEMAP_SPRITE
  return {
    version: 8,
    name: 'K39',
    glyphs: BASEMAP_GLYPHS,
    sprite,
    sources: {
      basemap: {
        type: 'vector',
        url: pmtilesSourceUrl(pmtilesUrl),
        maxzoom: 15,
        attribution: MAP_ATTRIBUTION_PMTILES,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': LAND } },
      {
        'id': 'land-wood',
        'type': 'fill',
        'source': 'basemap',
        'source-layer': 'landuse',
        'filter': ['match', ['get', 'kind'], ['wood', 'forest', 'scrub'], true, false],
        'paint': { 'fill-color': '#d5e0d2', 'fill-opacity': 0.7 },
      },
      {
        'id': 'land-grass',
        'type': 'fill',
        'source': 'basemap',
        'source-layer': 'landuse',
        'filter': ['match', ['get', 'kind'], ['grass', 'grassland', 'meadow', 'garden'], true, false],
        'paint': { 'fill-color': '#e3ebdc', 'fill-opacity': 0.55 },
      },
      {
        'id': 'land-sand',
        'type': 'fill',
        'source': 'basemap',
        'source-layer': 'landuse',
        'filter': ['match', ['get', 'kind'], ['sand', 'beach', 'farmland'], true, false],
        'paint': { 'fill-color': '#eadfca', 'fill-opacity': 0.4 },
      },
      {
        'id': 'land-residential',
        'type': 'fill',
        'source': 'basemap',
        'source-layer': 'landuse',
        'filter': ['==', ['get', 'kind'], 'residential'],
        'paint': { 'fill-color': '#e7dcc8', 'fill-opacity': 0.35 },
      },
      {
        'id': 'park',
        'type': 'fill',
        'source': 'basemap',
        'source-layer': 'landuse',
        'filter': ['match', ['get', 'kind'], ['park', 'nature_reserve', 'national_park'], true, false],
        'paint': { 'fill-color': '#d7e3d4', 'fill-opacity': 0.55 },
      },
      {
        'id': 'water',
        'type': 'fill',
        'source': 'basemap',
        'source-layer': 'water',
        'filter': ['all', polygon(), ['match', ['get', 'kind'], ['ocean', 'sea', 'lake', 'water', 'playa'], true, false]],
        'paint': { 'fill-color': WATER },
      },
      {
        'id': 'waterway',
        'type': 'line',
        'source': 'basemap',
        'source-layer': 'water',
        'filter': ['all', lineGeom(), ['match', ['get', 'kind'], ['river', 'stream', 'canal'], true, false]],
        'layout': { 'line-cap': 'round', 'line-join': 'round' },
        'paint': {
          'line-color': '#b7c9cf',
          'line-width': lineWidth([8, 0.4, 14, 2.2]),
        },
      },
      {
        'id': 'road-minor',
        'type': 'line',
        'source': 'basemap',
        'source-layer': 'roads',
        'minzoom': 12,
        'filter': ['all', lineGeom(), ['!=', ['get', 'is_tunnel'], true], ['any',
          ['all', ['==', ['get', 'kind'], 'minor_road'], ['match', ['get', 'kind_detail'], ['residential', 'unclassified', 'service', 'living_street'], true, false]],
          ['all', ['==', ['get', 'kind'], 'other'], ['==', ['get', 'kind_detail'], 'living_street']],
        ]],
        'layout': { 'line-cap': 'round', 'line-join': 'round' },
        'paint': {
          'line-color': '#f4eee4',
          'line-width': lineWidth([12, 0.2, 14, 1.4, 17, 6]),
        },
      },
      {
        'id': 'road-secondary',
        'type': 'line',
        'source': 'basemap',
        'source-layer': 'roads',
        'filter': ['all', lineGeom(), ['!=', ['get', 'is_tunnel'], true], ['==', ['get', 'kind'], 'minor_road'], ['match', ['get', 'kind_detail'], ['secondary', 'tertiary', 'secondary_link', 'tertiary_link'], true, false]],
        'layout': { 'line-cap': 'round', 'line-join': 'round' },
        'paint': {
          'line-color': '#eadcc8',
          'line-width': lineWidth([8, 0.4, 13, 2.2, 17, 8]),
        },
      },
      {
        'id': 'road-primary',
        'type': 'line',
        'source': 'basemap',
        'source-layer': 'roads',
        'filter': ['all', lineGeom(), ['!=', ['get', 'is_tunnel'], true], ['==', ['get', 'kind'], 'major_road']],
        'layout': { 'line-cap': 'round', 'line-join': 'round' },
        'paint': {
          'line-color': '#e2d0b4',
          'line-width': lineWidth([6, 0.5, 12, 2.6, 17, 10]),
        },
      },
      {
        'id': 'road-motorway',
        'type': 'line',
        'source': 'basemap',
        'source-layer': 'roads',
        'filter': ['all', lineGeom(), ['!=', ['get', 'is_tunnel'], true], ['==', ['get', 'kind'], 'highway']],
        'layout': { 'line-cap': 'round', 'line-join': 'round' },
        'paint': {
          'line-color': '#d7c2a4',
          'line-width': lineWidth([6, 0.6, 12, 3, 17, 11]),
        },
      },
      {
        'id': 'building',
        'type': 'fill',
        'source': 'basemap',
        'source-layer': 'buildings',
        'minzoom': 14,
        'filter': ['==', ['get', 'kind'], 'building'],
        'paint': { 'fill-color': '#e6dccb', 'fill-outline-color': '#d9cbb6' },
      },
      {
        'id': 'boundary',
        'type': 'line',
        'source': 'basemap',
        'source-layer': 'boundaries',
        'filter': ['all', ['==', ['get', 'kind'], 'country'], ['==', ['get', 'kind_detail'], 2]],
        'paint': {
          'line-color': '#c4b6a4',
          'line-width': 0.8,
          'line-opacity': 0.55,
          'line-dasharray': [2, 1.5],
        },
      },
      protomapsPlace('label-city', 'city', 4, [5, 13, 10, 18], FONT_BOLD, INK),
      protomapsPlace('label-town', 'town', 7, [7, 12, 12, 15], FONT, INK),
      protomapsPlace('label-village', ['village', 'hamlet'], 11, [11, 11, 14, 13], FONT, MUTED),
      {
        'id': 'water-name',
        'type': 'symbol',
        'source': 'basemap',
        'source-layer': 'water',
        'minzoom': 11,
        'filter': ['all', ['==', ['geometry-type'], 'Point'], ['match', ['get', 'kind'], ['sea', 'bay', 'ocean', 'lake', 'river'], true, false]],
        'layout': {
          'text-field': LOCAL_NAME,
          'text-font': FONT,
          'text-size': 11,
          'text-max-width': 6,
        },
        'paint': {
          'text-color': '#5d7380',
          'text-halo-color': HALO,
          'text-halo-width': 1,
        },
      },
    ],
  }
}

export function k39MapStyle(options?: { pmtilesUrl?: string | null, origin?: string }) {
  const url = options?.pmtilesUrl?.trim()
  if (url) {
    return protomapsStyle(url, options?.origin)
  }
  return openFreeMapStyle()
}
