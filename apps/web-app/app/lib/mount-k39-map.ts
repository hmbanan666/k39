import type { MapPoint, RouteOverlay } from '~~/shared/map'
import maplibregl from 'maplibre-gl'
import { K39_CENTER, K39_ZOOM } from '~~/shared/map'
import { k39MapStyle } from '~~/shared/map-style'
import { mapImages } from './map-icons'
import 'maplibre-gl/dist/maplibre-gl.css'

interface FeatureCollection {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    id?: string
    geometry: { type: 'Point', coordinates: [number, number] } | { type: 'LineString', coordinates: [number, number][] }
    properties: Record<string, string | number>
  }>
}

export interface K39MapHandle {
  setPoints: (points: MapPoint[]) => void
  setOverlay: (overlay: RouteOverlay | null) => void
  setSelected: (id: string | null) => void
  reveal: (id: string) => void
  fit: () => void
  zoomIn: () => void
  zoomOut: () => void
  locate: () => Promise<'ok' | 'denied' | 'unavailable'>
  resize: () => void
  destroy: () => void
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

function pointsData(points: MapPoint[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map((point) => ({
      type: 'Feature',
      id: point.id,
      geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] },
      properties: {
        id: point.id,
        marker: point.marker,
        partner: point.partner ? 1 : 0,
        title: point.title,
      },
    })),
  }
}

function stopsData(overlay: RouteOverlay | null): FeatureCollection {
  if (!overlay) {
    return EMPTY
  }
  return {
    type: 'FeatureCollection',
    features: overlay.stops.map((stop) => ({
      type: 'Feature',
      id: stop.id,
      geometry: { type: 'Point', coordinates: [stop.longitude, stop.latitude] },
      properties: { id: stop.id, n: stop.position, title: stop.title },
    })),
  }
}

function lineData(overlay: RouteOverlay | null): FeatureCollection {
  if (!overlay?.line || overlay.line.length < 2) {
    return EMPTY
  }
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: overlay.line },
      properties: { dashed: overlay.dashed ? 1 : 0 },
    }],
  }
}

function geoSource(map: maplibregl.Map, id: string) {
  const source = map.getSource(id)
  if (!source || source.type !== 'geojson') {
    return null
  }
  return source as maplibregl.GeoJSONSource
}

export async function mountK39Map(el: HTMLElement, options: {
  points: MapPoint[]
  overlay: RouteOverlay | null
  cooperative: boolean
  onSelect: (id: string) => void
  onEmpty: () => void
}): Promise<K39MapHandle> {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const duration = reduce ? 0 : 450
  let points = options.points
  let overlay = options.overlay
  let selected: string | null = null
  let hovered: { source: string, id: string } | null = null

  const map = new maplibregl.Map({
    container: el,
    style: k39MapStyle() as maplibregl.StyleSpecification,
    center: K39_CENTER,
    zoom: K39_ZOOM,
    attributionControl: { compact: true },
    cooperativeGestures: options.cooperative,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    maxZoom: 17,
    fadeDuration: reduce ? 0 : 160,
    locale: {
      'CooperativeGesturesHandler.WindowsHelpText': 'Чтобы менять масштаб, зажмите Ctrl и прокрутите',
      'CooperativeGesturesHandler.MacHelpText': 'Чтобы менять масштаб, зажмите ⌘ и прокрутите',
      'CooperativeGesturesHandler.MobileHelpText': 'Двигайте карту двумя пальцами',
    },
  })

  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Map style did not load')), 12000)
    map.once('load', () => {
      window.clearTimeout(timer)
      resolve()
    })
  })

  for (const [id, image] of Object.entries(mapImages())) {
    if (!map.hasImage(id)) {
      map.addImage(id, image, { pixelRatio: 2 })
    }
  }

  map.addSource('places', {
    type: 'geojson',
    data: pointsData(points),
    cluster: true,
    clusterRadius: 48,
    clusterMaxZoom: 13,
  })
  map.addSource('route-line', { type: 'geojson', data: lineData(overlay) })
  map.addSource('stops', { type: 'geojson', data: stopsData(overlay) })

  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'places',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#fffbf3',
      'circle-stroke-color': '#a3402a',
      'circle-stroke-width': 2,
      'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 30, 24],
    },
  })
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'places',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 13,
    },
    paint: { 'text-color': '#2b2420' },
  })
  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route-line',
    filter: ['==', ['get', 'dashed'], 0],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#a3402a',
      'line-width': 3,
      'line-opacity': 0.9,
    },
  })
  map.addLayer({
    id: 'route-dashed',
    type: 'line',
    source: 'route-line',
    filter: ['==', ['get', 'dashed'], 1],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#a3402a',
      'line-width': 2.5,
      'line-opacity': 0.75,
      'line-dasharray': [1.2, 1.15],
    },
  })
  map.addLayer({
    id: 'pin-halo',
    type: 'circle',
    source: 'places',
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
    id: 'pins',
    type: 'symbol',
    source: 'places',
    filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': ['get', 'marker'],
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-size': 1,
    },
  })
  map.addLayer({
    id: 'partner-dot',
    type: 'circle',
    source: 'places',
    filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'partner'], 1]],
    paint: {
      'circle-color': '#d68a22',
      'circle-stroke-color': '#fffbf3',
      'circle-stroke-width': 1.5,
      'circle-radius': 4.5,
      'circle-translate': [11, -30],
    },
  })
  map.addLayer({
    id: 'stop-halo',
    type: 'circle',
    source: 'stops',
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
    id: 'stops',
    type: 'symbol',
    source: 'stops',
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

  function applySelected(id: string | null) {
    if (selected) {
      for (const source of ['places', 'stops']) {
        map.setFeatureState({ source, id: selected }, { selected: false })
      }
    }
    selected = id
    if (!id) {
      return
    }
    const source = id.startsWith('stop:') ? 'stops' : 'places'
    map.setFeatureState({ source, id }, { selected: true })
  }

  function hover(source: string, id: string | null) {
    if (hovered) {
      map.setFeatureState({ source: hovered.source, id: hovered.id }, { hover: false })
      hovered = null
    }
    if (!id) {
      map.getCanvas().style.cursor = ''
      return
    }
    hovered = { source, id }
    map.setFeatureState({ source, id }, { hover: true })
    map.getCanvas().style.cursor = 'pointer'
  }

  function featureId(event: maplibregl.MapLayerMouseEvent) {
    const feature = event.features?.[0]
    const id = feature?.properties?.id
    return id == null ? null : String(id)
  }

  map.on('click', 'clusters', (event) => {
    const feature = event.features?.[0]
    const clusterId = feature?.properties?.cluster_id
    const geometry = feature?.geometry
    if (clusterId == null || geometry?.type !== 'Point') {
      return
    }
    const source = geoSource(map, 'places')
    const center = geometry.coordinates as [number, number]
    void source?.getClusterExpansionZoom(Number(clusterId)).then((zoom) => {
      map.easeTo({ center, zoom, duration })
    }).catch(() => {})
  })
  map.on('click', 'pins', (event) => {
    const id = featureId(event)
    if (id) {
      options.onSelect(id)
    }
  })
  map.on('click', 'stops', (event) => {
    const id = featureId(event)
    if (id) {
      options.onSelect(id)
    }
  })
  map.on('click', (event) => {
    const layers = ['pins', 'stops', 'clusters'].filter((id) => map.getLayer(id))
    const hits = layers.length ? map.queryRenderedFeatures(event.point, { layers }) : []
    if (!hits.length) {
      options.onEmpty()
    }
  })
  map.on('mousemove', 'pins', (event) => hover('places', featureId(event)))
  map.on('mouseleave', 'pins', () => hover('places', null))
  map.on('mousemove', 'stops', (event) => hover('stops', featureId(event)))
  map.on('mouseleave', 'stops', () => hover('stops', null))
  map.on('mousemove', 'clusters', () => {
    map.getCanvas().style.cursor = 'pointer'
  })
  map.on('mouseleave', 'clusters', () => {
    map.getCanvas().style.cursor = ''
  })

  function boundsOf() {
    const bounds = new maplibregl.LngLatBounds()
    const coords = [
      ...points.map((point) => [point.longitude, point.latitude] as [number, number]),
      ...(overlay?.line || []),
      ...(overlay?.stops.map((stop) => [stop.longitude, stop.latitude] as [number, number]) || []),
    ]
    for (const coord of coords) {
      bounds.extend(coord)
    }
    return bounds.isEmpty() ? null : bounds
  }

  function fit() {
    if (points.length === 1 && !overlay?.stops.length) {
      const point = points[0]
      if (point) {
        map.easeTo({ center: [point.longitude, point.latitude], zoom: 15, duration })
      }
      return
    }
    const bounds = boundsOf()
    if (!bounds) {
      map.easeTo({ center: K39_CENTER, zoom: K39_ZOOM, duration })
      return
    }
    map.fitBounds(bounds, { padding: 56, maxZoom: 15, duration })
  }

  function findCoord(id: string): [number, number] | null {
    const point = points.find((item) => item.id === id)
    if (point) {
      return [point.longitude, point.latitude]
    }
    const stop = overlay?.stops.find((item) => item.id === id)
    return stop ? [stop.longitude, stop.latitude] : null
  }

  const details = map.getContainer().querySelector('details.maplibregl-ctrl-attrib')
  if (details instanceof HTMLDetailsElement) {
    details.open = false
  }

  requestAnimationFrame(() => map.resize())

  return {
    setPoints(next) {
      points = next
      geoSource(map, 'places')?.setData(pointsData(points))
      if (selected) {
        applySelected(selected)
      }
    },
    setOverlay(next) {
      overlay = next
      geoSource(map, 'route-line')?.setData(lineData(overlay))
      geoSource(map, 'stops')?.setData(stopsData(overlay))
      if (selected) {
        applySelected(selected)
      }
    },
    setSelected(id) {
      applySelected(id)
    },
    reveal(id) {
      const coord = findCoord(id)
      if (!coord) {
        return
      }
      map.easeTo({ center: coord, zoom: Math.max(map.getZoom(), 13), duration })
    },
    fit,
    zoomIn() {
      map.zoomIn({ duration })
    },
    zoomOut() {
      map.zoomOut({ duration })
    },
    locate() {
      if (!navigator.geolocation) {
        return Promise.resolve('unavailable')
      }
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition((position) => {
          map.easeTo({
            center: [position.coords.longitude, position.coords.latitude],
            zoom: Math.max(map.getZoom(), 14),
            duration,
          })
          resolve('ok')
        }, () => resolve('denied'), { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 })
      })
    },
    resize() {
      map.resize()
    },
    destroy() {
      map.remove()
    },
  }
}
