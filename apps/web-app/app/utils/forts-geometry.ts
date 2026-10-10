export interface FortsGeo {
  W: number
  H: number
  K: number
  COS: number
  LON0: number
  LAT1: number
  water: string
  islands: string[]
  rivers: Array<{ name: string | null, d: string }>
  city: string
  lakes: Array<{ name: string, d: string }>
}

export interface MapObject {
  id: string
  slug: string
  type: 'fort' | 'gate' | 'tower' | 'landmark'
  num: string | null
  name: string
  de?: string | null
  lat: number
  lon: number
  ring?: 'main' | 'small' | null
  status: string
  status_text: string
  status_src?: [string, string] | null
  hours?: string | null
  hours_src?: [string, string] | null
  hours_note?: string | null
  desc: string
  src: [string, string]
  how: string
  yandex: string
  inside: boolean
  ruin: boolean
  name_note?: string | null
  x: number
  y: number
}

export const FORT_STATUS: Record<string, { color: string, label: string }> = {
  museum: { color: '#6f8f5a', label: 'Музей / открыт' },
  open: { color: '#86a06a', label: 'Открыт для посещения' },
  tour: { color: '#9aa85a', label: 'С экскурсоводом' },
  free: { color: '#c9934a', label: 'Свободный доступ' },
  restoration: { color: '#b07a5f', label: 'Реставрация, закрыт' },
  closed: { color: '#8c4a3c', label: 'Закрыт' },
  military: { color: '#5d4e6b', label: 'Военный объект' },
  check: { color: '#a69d8e', label: 'Статус уточняется' },
}

export const GATE_PATH = 'M-10,7 V-5 h1.6 v-2.4 h1.6 v2.4 h1.6 v-2.4 h1.6 v2.4 h7.2 v-2.4 h1.6 v2.4 h1.6 v-2.4 h1.6 v2.4 h1.6 V7 H3.6 V2 A3.6,3.6 0 0 0 -3.6,2 V7 Z'
export const TOWER_PATH = 'M-6,7 V-4 h2 v-2.6 h2.4 V-4 h3.2 v-2.6 h2.4 V-4 h2 V7 Z'
export const CHURCH_PATH = 'M-9,8 V-1 L-4,-5 V-7 L-1.5,-9 V-15 L0,-19 L1.5,-15 V-9 L4,-7 V-5 L9,-1 V8 Z'

export function project(geo: FortsGeo, lon: number, lat: number) {
  return {
    x: (lon - geo.LON0) * geo.COS * geo.K,
    y: (geo.LAT1 - lat) * geo.K,
  }
}

export function centroid(points: Array<{ x: number, y: number }>) {
  const count = points.length || 1
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / count,
    y: points.reduce((sum, point) => sum + point.y, 0) / count,
  }
}

export function byAngle<T extends { x: number, y: number }>(list: T[], cx: number, cy: number) {
  return list.slice().sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx))
}

export function catmull(pts: Array<[number, number]>, closed: boolean) {
  const n = pts.length
  const first = pts[0]
  if (!first || n === 0) {
    return ''
  }
  let d = `M${first[0].toFixed(1)},${first[1].toFixed(1)}`
  const get = (index: number) => {
    if (closed) {
      return pts[(index + n) % n] ?? first
    }
    return pts[Math.max(0, Math.min(n - 1, index))] ?? first
  }
  const last = closed ? n : n - 1
  const tension = 0.5 / 3 * 2
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1)
    const p1 = get(i)
    const p2 = get(i + 1)
    const p3 = get(i + 2)
    const c1x = p1[0] + (p2[0] - p0[0]) * tension / 2
    const c1y = p1[1] + (p2[1] - p0[1]) * tension / 2
    const c2x = p2[0] - (p3[0] - p1[0]) * tension / 2
    const c2y = p2[1] - (p3[1] - p1[1]) * tension / 2
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return closed ? `${d}Z` : d
}

export function legPath(points: Array<[number, number]>, index: number) {
  const n = points.length
  const tension = 1 / 6
  const p0 = points[Math.max(0, index - 1)]
  const p1 = points[index]
  const p2 = points[index + 1]
  const p3 = points[Math.min(n - 1, index + 2)]
  if (!p0 || !p1 || !p2 || !p3) {
    return ''
  }
  const c1x = p1[0] + (p2[0] - p0[0]) * tension
  const c1y = p1[1] + (p2[1] - p0[1]) * tension
  const c2x = p2[0] - (p3[0] - p1[0]) * tension
  const c2y = p2[1] - (p3[1] - p1[1]) * tension
  return `M${p1[0].toFixed(1)},${p1[1].toFixed(1)} C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
}

export function bastionPath(radius: number) {
  const pts: string[] = []
  for (let i = 0; i < 5; i++) {
    const angle = (-90 + i * 72) * Math.PI / 180
    const shoulder = 21 * Math.PI / 180
    const flank = 36 * Math.PI / 180
    const push = (theta: number, r: number) => {
      pts.push(`${(Math.cos(theta) * r).toFixed(2)},${(Math.sin(theta) * r).toFixed(2)}`)
    }
    push(angle - shoulder, radius * 0.66)
    push(angle, radius)
    push(angle + shoulder, radius * 0.66)
    push(angle + flank, radius * 0.56)
  }
  return `M${pts.join(' L')}Z`
}
