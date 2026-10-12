import type { RouteMapPoint } from '~~/shared/route-nav'

export interface MountedRouteMap {
  destroy: () => void
  enableDragging: () => void
  coarseLock: boolean
}

interface YandexFeature {
  geometry: { type: 'LineString', coordinates: number[][] }
  style: { stroke: Array<{ color: string, width: number }> }
}

interface YandexMap {
  addChild: (child: unknown) => void
  destroy: () => void
}

interface YandexNamespace {
  ready: Promise<void>
  YMap: new (element: HTMLElement, props: { location: Record<string, unknown> }) => YandexMap
  YMapDefaultSchemeLayer: new () => unknown
  YMapDefaultFeaturesLayer: new () => unknown
  YMapMarker: new (props: { coordinates: number[] }, element: HTMLElement) => unknown
  YMapFeature?: new (props: YandexFeature) => unknown
}

const BRICK = '#A3402A'

function bounds(points: RouteMapPoint[]) {
  const lats = points.map((point) => point.latitude)
  const lngs = points.map((point) => point.longitude)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const latPad = Math.max((maxLat - minLat) * 0.25, 0.04)
  const lngPad = Math.max((maxLng - minLng) * 0.25, 0.04)
  return {
    flat: maxLat - minLat < 0.0008 && maxLng - minLng < 0.0008,
    // Yandex bounds are longitude, latitude. rtext on the deep link is the reverse.
    yandex: [
      [minLng - lngPad, minLat - latPad],
      [maxLng + lngPad, maxLat + latPad],
    ] as [[number, number], [number, number]],
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const named: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }
    return named[char] ?? char
  })
}

function loadYandex(apiKey: string) {
  const current = (window as Window & { ymaps3?: YandexNamespace }).ymaps3
  if (current) {
    return Promise.resolve(current)
  }
  return new Promise<YandexNamespace>((resolve, reject) => {
    const script = document.createElement('script')
    const url = new URL('https://api-maps.yandex.ru/v3/')
    url.searchParams.set('apikey', apiKey)
    url.searchParams.set('lang', 'ru_RU')
    script.src = url.toString()
    script.async = true
    script.onload = () => {
      const api = (window as Window & { ymaps3?: YandexNamespace }).ymaps3
      if (api) {
        resolve(api)
      } else {
        reject(new Error('Yandex Maps did not start'))
      }
    }
    script.onerror = () => reject(new Error('Yandex Maps script failed'))
    document.head.appendChild(script)
  })
}

async function mountYandex(el: HTMLElement, points: RouteMapPoint[], apiKey: string): Promise<MountedRouteMap> {
  const ymaps3 = await loadYandex(apiKey)
  await ymaps3.ready
  const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker, YMapFeature } = ymaps3
  if (!YMap || !YMapDefaultSchemeLayer || !YMapDefaultFeaturesLayer || !YMapMarker || !YMapFeature) {
    throw new Error('Yandex Maps API is incomplete')
  }
  const box = bounds(points)
  const first = points[0]
  if (!first) {
    throw new Error('No stops')
  }
  const map = new YMap(el, {
    location: box.flat
      ? { center: [first.longitude, first.latitude], zoom: 14 }
      : { bounds: box.yandex },
  })
  map.addChild(new YMapDefaultSchemeLayer())
  map.addChild(new YMapDefaultFeaturesLayer())
  if (points.length > 1) {
    map.addChild(new YMapFeature({
      geometry: {
        type: 'LineString',
        coordinates: points.map((point) => [point.longitude, point.latitude]),
      },
      style: { stroke: [{ color: BRICK, width: 4 }] },
    }))
  }
  for (const point of points) {
    const marker = document.createElement('div')
    marker.className = 'route-pin yandex-pin'
    marker.textContent = point.label
    marker.title = point.title
    map.addChild(new YMapMarker({ coordinates: [point.longitude, point.latitude] }, marker))
  }
  return {
    destroy: () => map.destroy(),
    enableDragging: () => {},
    coarseLock: false,
  }
}

async function mountLeaflet(el: HTMLElement, points: RouteMapPoint[]): Promise<MountedRouteMap> {
  const imported = await import('leaflet')
  await import('leaflet/dist/leaflet.css')
  // Vite's CJS interop sometimes nests the UMD build under default.
  const L = typeof imported.map === 'function'
    ? imported
    : (imported as unknown as { default: typeof imported }).default
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const map = L.map(el, {
    scrollWheelZoom: false,
    dragging: !coarse,
    fadeAnimation: !reduce,
    zoomAnimation: !reduce,
    zoomControl: true,
  })
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener nofollow">OpenStreetMap</a>',
  }).addTo(map)
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener nofollow">Leaflet</a>')
  const latLngs = points.map((point) => [point.latitude, point.longitude] as [number, number])
  if (latLngs.length > 1) {
    const line = L.polyline(latLngs, { color: BRICK, weight: 4, opacity: 0.92, lineJoin: 'round', lineCap: 'round' })
    line.addTo(map)
    map.fitBounds(line.getBounds(), { padding: [36, 36] })
  } else if (latLngs[0]) {
    map.setView(latLngs[0], 14)
  }
  for (const point of points) {
    const icon = L.divIcon({
      className: 'route-pin-wrap',
      html: `<span class="route-pin" title="${escapeHtml(point.title)}">${escapeHtml(point.label)}</span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    })
    L.marker([point.latitude, point.longitude], { icon, title: point.title, keyboard: false }).addTo(map)
  }
  if (coarse) {
    map.getContainer().style.touchAction = 'pan-y'
  }
  requestAnimationFrame(() => map.invalidateSize())
  return {
    destroy: () => map.remove(),
    enableDragging: () => {
      map.dragging.enable()
      map.getContainer().style.touchAction = 'none'
    },
    coarseLock: coarse,
  }
}

export async function mountRouteMap(el: HTMLElement, points: RouteMapPoint[], apiKey: string) {
  if (!points.length) {
    throw new Error('No stops to map')
  }
  const key = apiKey.trim()
  if (key) {
    try {
      return await mountYandex(el, points, key)
    } catch {
      // A bad key or a blocked script still leaves the stops on Leaflet.
    }
  }
  return mountLeaflet(el, points)
}
