import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl'
import type { MapPoint } from '~~/shared/map'
import { clusterPoints, MAP_MAX_ZOOM, MAP_STYLE_URL, pinButtonHtml, resolvedFrameHeight } from '~~/shared/map'

export interface DrawPoint extends MapPoint {
  focus: boolean
}

export interface MountedK39Map {
  destroy: () => void
  setPoints: (points: DrawPoint[], lines: Array<Array<[number, number]>>) => void
  enableDragging: () => void
  coarseLock: boolean
}

const BRICK = '#A3402A'
const OBLAST_BOUNDS: [[number, number], [number, number]] = [[18.6, 53.8], [23.6, 55.9]]

function ensureHeight(el: HTMLElement, fallback: number) {
  const frame = el.parentElement
  const measured = Math.max(el.clientHeight, frame?.clientHeight || 0)
  const height = resolvedFrameHeight(measured, fallback)
  el.style.width = '100%'
  el.style.height = `${height}px`
  if (frame && measured < 160) {
    frame.style.height = `${height}px`
    frame.style.minHeight = `${height}px`
  }
}

function elementFromHtml(html: string) {
  const wrap = document.createElement('div')
  wrap.innerHTML = html
  const node = wrap.firstElementChild
  if (!(node instanceof HTMLElement)) {
    throw new TypeError('Pin markup is empty')
  }
  return node
}

export async function mountK39Map(
  el: HTMLElement,
  options: {
    fallbackHeight: number
    onSelect: (id: string) => void
    onImpression: (href: string) => void
  },
): Promise<MountedK39Map> {
  const maplibregl = await import('maplibre-gl')
  await import('maplibre-gl/dist/maplibre-gl.css')
  ensureHeight(el, options.fallbackHeight)
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const map: MapLibreMap = new maplibregl.Map({
    container: el,
    style: MAP_STYLE_URL,
    center: [20.5, 54.71],
    zoom: 8,
    minZoom: 5,
    maxZoom: MAP_MAX_ZOOM,
    maxBounds: OBLAST_BOUNDS,
    attributionControl: { compact: false },
    fadeDuration: reduce ? 0 : 300,
    dragRotate: false,
    pitchWithRotate: false,
  })
  map.scrollZoom.disable()
  map.touchZoomRotate.disableRotation()
  map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), 'top-right')
  if (coarse) {
    map.dragPan.disable()
    map.getCanvas().style.touchAction = 'pan-y'
  }

  const seen = new Set<string>()
  const markers: Marker[] = []
  let currentPoints: DrawPoint[] = []
  let currentLines: Array<Array<[number, number]>> = []
  let fitted = false
  let suspend = 0
  let styleReady = false

  function patchAttribution() {
    el.querySelectorAll('.maplibregl-ctrl-attrib a').forEach((node) => {
      if (!(node instanceof HTMLAnchorElement)) {
        return
      }
      node.target = '_blank'
      node.rel = 'noopener nofollow'
    })
  }

  function remember(point: DrawPoint) {
    if (seen.has(point.href)) {
      return
    }
    seen.add(point.href)
    options.onImpression(point.href)
  }

  function clearMarkers() {
    for (const marker of markers) {
      marker.remove()
    }
    markers.length = 0
  }

  function addPin(point: DrawPoint) {
    const button = elementFromHtml(pinButtonHtml(point))
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      options.onSelect(point.id)
    })
    const marker = new maplibregl.Marker({ element: button, anchor: 'center' })
      .setLngLat([point.longitude, point.latitude])
      .addTo(map)
    markers.push(marker)
    remember(point)
  }

  function syncLines() {
    const data = {
      type: 'FeatureCollection' as const,
      features: currentLines.filter((line) => line.length > 1).map((line) => ({
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: line.map(([latitude, longitude]) => [longitude, latitude]),
        },
      })),
    }
    const existing = map.getSource('k39-routes') as GeoJSONSource | undefined
    if (existing) {
      existing.setData(data)
      return
    }
    map.addSource('k39-routes', { type: 'geojson', data })
    map.addLayer({
      id: 'k39-routes',
      type: 'line',
      source: 'k39-routes',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': BRICK, 'line-width': 4, 'line-opacity': 0.92 },
    })
  }

  function draw() {
    if (!styleReady) {
      return
    }
    clearMarkers()
    syncLines()
    const focus = currentPoints.filter((point) => point.focus)
    const rest = currentPoints.filter((point) => !point.focus)
    const zoom = map.getZoom()
    for (const point of focus) {
      addPin(point)
    }
    for (const cluster of clusterPoints(rest, zoom)) {
      const only = cluster.points[0]
      if (cluster.points.length === 1 && only) {
        addPin(only)
        continue
      }
      const button = elementFromHtml(`<button type="button" class="k39-cluster" aria-label="Группа из ${cluster.points.length}">${cluster.points.length}</button>`)
      button.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        const bounds = new maplibregl.LngLatBounds()
        for (const point of cluster.points) {
          bounds.extend([point.longitude, point.latitude])
        }
        suspend += 1
        map.fitBounds(bounds, {
          padding: 42,
          maxZoom: Math.min(zoom + 2, 17),
          animate: !reduce,
          duration: reduce ? 0 : 400,
        })
        map.once('idle', () => {
          suspend = Math.max(0, suspend - 1)
          draw()
        })
      })
      const marker = new maplibregl.Marker({ element: button, anchor: 'center' })
        .setLngLat([cluster.longitude, cluster.latitude])
        .addTo(map)
      markers.push(marker)
    }
    patchAttribution()
  }

  function fit() {
    const coords: Array<[number, number]> = [
      ...currentPoints.map((point) => [point.longitude, point.latitude] as [number, number]),
      ...currentLines.flat().map(([latitude, longitude]) => [longitude, latitude] as [number, number]),
    ]
    suspend += 1
    if (coords.length === 1 && coords[0]) {
      map.jumpTo({ center: coords[0], zoom: 15 })
    } else if (coords.length > 1) {
      const bounds = new maplibregl.LngLatBounds()
      for (const coord of coords) {
        bounds.extend(coord)
      }
      map.fitBounds(bounds, { padding: 42, maxZoom: 15, animate: false, duration: 0 })
    } else {
      map.jumpTo({ center: [20.5, 54.71], zoom: 8 })
    }
    suspend = Math.max(0, suspend - 1)
  }

  function apply() {
    if (!styleReady) {
      return
    }
    const hasGeometry = currentPoints.length > 0 || currentLines.some((line) => line.length > 0)
    if (!fitted && hasGeometry) {
      fit()
      fitted = true
    }
    draw()
  }

  map.on('load', () => {
    styleReady = true
    patchAttribution()
    apply()
    map.resize()
  })
  map.on('zoomend', () => {
    if (suspend > 0) {
      return
    }
    draw()
  })

  const frame = el.parentElement
  const observer = new ResizeObserver(() => {
    const next = Math.max(el.parentElement?.clientHeight || 0, el.clientHeight)
    if (next >= 160) {
      el.style.height = `${next}px`
    }
    map.resize()
  })
  observer.observe(frame || el)
  requestAnimationFrame(() => map.resize())

  return {
    coarseLock: coarse,
    enableDragging: () => {
      map.dragPan.enable()
      map.getCanvas().style.touchAction = 'auto'
    },
    setPoints: (points, nextLines) => {
      currentPoints = points
      currentLines = nextLines
      apply()
    },
    destroy: () => {
      observer.disconnect()
      clearMarkers()
      map.remove()
    },
  }
}
