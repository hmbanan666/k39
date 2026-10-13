import type { MapLayer } from '@k39/map'
import { basemapFromUrl, layerCoordinates, lonePoint, MAP_CENTER, MAP_ZOOM, mapStyle } from '@k39/map'
import maplibregl from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import { mapImages } from './map-icons'
import { eraseMapLayer, interactivePaintIds, paintMapLayer, replaceMapLayerData } from './sync-map-layers'
import 'maplibre-gl/dist/maplibre-gl.css'

export interface K39MapHandle {
  setLayers: (layers: MapLayer[]) => void
  setSelected: (id: string | null) => void
  reveal: (id: string) => void
  fit: () => void
  zoomIn: () => void
  zoomOut: () => void
  locate: () => Promise<'ok' | 'denied' | 'unavailable'>
  resize: () => void
  destroy: () => void
}

function geoSource(map: maplibregl.Map, id: string) {
  const source = map.getSource(id)
  if (!source || source.type !== 'geojson') {
    return null
  }
  return source as maplibregl.GeoJSONSource
}

function ensurePmtilesProtocol() {
  const flag = globalThis as typeof globalThis & { __k39Pmtiles?: boolean }
  if (flag.__k39Pmtiles) {
    return
  }
  const protocol = new Protocol()
  maplibregl.addProtocol('pmtiles', protocol.tile)
  flag.__k39Pmtiles = true
}

export async function mountK39Map(el: HTMLElement, options: {
  layers: MapLayer[]
  cooperative: boolean
  pmtilesUrl?: string
  onSelect: (id: string) => void
  onEmpty: () => void
}): Promise<K39MapHandle> {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const duration = reduce ? 0 : 450
  const known = new Set(Object.keys(mapImages()))
  let layers = options.layers
  let selected: string | null = null
  let hovered: { source: string, id: string } | null = null
  const mounted = new Map<string, MapLayer>()

  const pmtilesUrl = options.pmtilesUrl?.trim() || ''
  if (pmtilesUrl) {
    ensurePmtilesProtocol()
  }
  const map = new maplibregl.Map({
    container: el,
    style: mapStyle('paper', basemapFromUrl(pmtilesUrl, window.location.origin)) as maplibregl.StyleSpecification,
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
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

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Map style did not load')), 12000)
      map.once('load', () => {
        window.clearTimeout(timer)
        resolve()
      })
    })
  } catch (error) {
    map.remove()
    throw error
  }

  for (const [id, image] of Object.entries(mapImages())) {
    if (!map.hasImage(id)) {
      map.addImage(id, image, { pixelRatio: 2 })
    }
  }

  function sync(next: MapLayer[]) {
    const keep = new Set(next.map((layer) => layer.id))
    for (const [id, previous] of [...mounted]) {
      if (!keep.has(id)) {
        eraseMapLayer(map, previous)
        mounted.delete(id)
      }
    }
    for (const layer of next) {
      const previous = mounted.get(layer.id)
      const clusterChanged = previous?.type === 'points' && layer.type === 'points' && previous.cluster !== layer.cluster
      if (previous && (previous.type !== layer.type || clusterChanged)) {
        eraseMapLayer(map, previous)
        mounted.delete(layer.id)
      }
      if (!mounted.has(layer.id)) {
        paintMapLayer(map, layer, known)
        mounted.set(layer.id, layer)
      } else {
        replaceMapLayerData(map, layer, known)
      }
    }
    layers = next
  }

  sync(layers)

  function paintIds() {
    return layers.flatMap((layer) => interactivePaintIds(layer)).filter((id) => map.getLayer(id))
  }

  function applySelected(id: string | null) {
    if (selected) {
      for (const layer of layers) {
        map.setFeatureState({ source: layer.id, id: selected }, { selected: false })
      }
    }
    selected = id
    if (!id) {
      return
    }
    const source = layers.find((layer) => (
      (layer.type === 'points' && layer.points.some((point) => point.id === id))
      || (layer.type === 'stops' && layer.stops.some((stop) => stop.id === id))
    ))?.id
    if (source && map.getSource(source)) {
      map.setFeatureState({ source, id }, { selected: true })
    }
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

  map.on('click', (event) => {
    const names = paintIds()
    const hits = names.length ? map.queryRenderedFeatures(event.point, { layers: names }) : []
    const hit = hits[0]
    if (!hit) {
      options.onEmpty()
      return
    }
    const clusterId = hit.properties?.cluster_id
    const layerId = hit.layer?.id || ''
    const sourceId = hit.layer?.source || ''
    if (clusterId != null && hit.geometry.type === 'Point' && layerId.endsWith('-clusters')) {
      const source = geoSource(map, sourceId)
      const center = hit.geometry.coordinates as [number, number]
      void source?.getClusterExpansionZoom(Number(clusterId)).then((zoom) => {
        map.easeTo({ center, zoom, duration })
      }).catch(() => {})
      return
    }
    const id = hit.properties?.id
    if (id != null) {
      options.onSelect(String(id))
    }
  })
  map.on('mousemove', (event) => {
    const names = paintIds()
    const hits = names.length ? map.queryRenderedFeatures(event.point, { layers: names }) : []
    const hit = hits[0]
    if (!hit) {
      hover('', null)
      return
    }
    if (hit.properties?.cluster_id != null) {
      map.getCanvas().style.cursor = 'pointer'
      return
    }
    const id = hit.properties?.id
    if (id == null) {
      hover('', null)
      return
    }
    hover(hit.layer?.source || '', String(id))
  })
  map.on('mouseleave', () => hover('', null))

  function boundsOf() {
    const bounds = new maplibregl.LngLatBounds()
    for (const coord of layerCoordinates(layers)) {
      bounds.extend(coord)
    }
    return bounds.isEmpty() ? null : bounds
  }

  function fit() {
    const single = lonePoint(layers)
    if (single) {
      map.easeTo({ center: single, zoom: 15, duration })
      return
    }
    const bounds = boundsOf()
    if (!bounds) {
      map.easeTo({ center: MAP_CENTER, zoom: MAP_ZOOM, duration })
      return
    }
    map.fitBounds(bounds, { padding: 56, maxZoom: 15, duration })
  }

  function findCoord(id: string): [number, number] | null {
    for (const layer of layers) {
      if (layer.type === 'points') {
        const point = layer.points.find((item) => item.id === id)
        if (point) {
          return point.coordinates
        }
      }
      if (layer.type === 'stops') {
        const stop = layer.stops.find((item) => item.id === id)
        if (stop) {
          return stop.coordinates
        }
      }
    }
    return null
  }

  const details = map.getContainer().querySelector('details.maplibregl-ctrl-attrib')
  if (details instanceof HTMLDetailsElement) {
    details.open = false
  }
  requestAnimationFrame(() => map.resize())

  return {
    setLayers(next) {
      sync(next)
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
