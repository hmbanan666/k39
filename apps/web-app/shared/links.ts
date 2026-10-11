export interface TextLink {
  href: string
  text: string
}

export interface GraphPage {
  path: string
  outbound: TextLink[]
}

export const HUBS: TextLink[] = [
  { href: '/forty', text: 'Форты' },
  { href: '/zamki', text: 'Замки' },
  { href: '/plyazhi', text: 'Пляжи' },
  { href: '/kurorty', text: 'Курорты' },
  { href: '/muzei', text: 'Музеи' },
  { href: '/eda', text: 'Еда' },
]

export const SECTION_LINKS: TextLink[] = [
  { href: '/marshruty', text: 'Маршруты' },
  { href: '/podborki', text: 'Подборки' },
  { href: '/kvesty', text: 'Квесты' },
]

export function homeLinks(extra: TextLink[] = []) {
  return [...HUBS, ...SECTION_LINKS, { href: '/legal/privacy-policy', text: 'Политика конфиденциальности' }, ...extra]
}

export function uniqueLinks(links: TextLink[]) {
  const seen = new Set<string>()
  return links.filter((link) => {
    if (seen.has(link.href)) {
      return false
    }
    seen.add(link.href)
    return true
  })
}

export function findOrphans(pages: GraphPage[]) {
  const inbound = new Map<string, number>()
  for (const page of pages) {
    inbound.set(page.path, inbound.get(page.path) ?? 0)
    for (const link of page.outbound) {
      const path = link.href.split('?')[0] || '/'
      inbound.set(path, (inbound.get(path) ?? 0) + 1)
    }
  }
  return [...inbound.entries()]
    .filter(([path, count]) => path !== '/' && count === 0)
    .map(([path]) => path)
}

export function formatDistance(km: number) {
  if (!Number.isFinite(km) || km < 0) {
    return ''
  }
  if (km < 1) {
    const meters = Math.max(50, Math.round((km * 1000) / 50) * 50)
    return `около ${meters} м`
  }
  if (km >= 10) {
    return `${Math.round(km)} км`
  }
  const rounded = Math.round(km * 10) / 10
  const text = rounded.toFixed(1).replace('.', ',').replace(/,0$/, '')
  return `${text} км`
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (value: number) => value * Math.PI / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)))
}
