export const MAP_CENTER: [number, number] = [20.55, 54.72]

export const MAP_ZOOM = 8

export const MAP_ATTRIBUTION = '<a href="https://openfreemap.org/" target="_blank" rel="noopener nofollow">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener nofollow">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener nofollow">OpenStreetMap</a>'

export const MAP_ATTRIBUTION_PMTILES = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener nofollow">OpenStreetMap contributors</a> © <a href="https://protomaps.com" target="_blank" rel="noopener nofollow">Protomaps</a>'

export const BASEMAP_GLYPHS = '/basemap/fonts/{fontstack}/{range}.pbf'

export const BASEMAP_SPRITE = '/basemap/sprites/k39'

export interface BasemapSpec {
  pmtilesUrl?: string | null
  origin?: string
}

export function pmtilesSourceUrl(url: string) {
  const value = url.trim()
  if (value.startsWith('pmtiles://')) {
    return value
  }
  return `pmtiles://${value}`
}

export function basemapFromUrl(pmtilesUrl?: string | null, origin?: string): BasemapSpec {
  return {
    pmtilesUrl: pmtilesUrl?.trim() || null,
    origin,
  }
}
