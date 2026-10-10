export interface PlacePageModel {
  title: string
  description: string
  slug: string
  placeType: string
  status: 'open' | 'ruins' | 'unknown'
  statusLabel: string
  hours?: string | null
  hoursNote?: string | null
  nameNote?: string | null
  germanName?: string | null
  lat: number
  lon: number
  sourceName: string
  sourceUrl: string
  how?: string | null
  mapId?: string | null
  region: string
}

export const STATUS_TITLE: Record<PlacePageModel['status'], string> = {
  open: 'Открыт',
  ruins: 'Руины',
  unknown: 'Статус неизвестен',
}

export const PLACE_TYPE_TITLE: Record<string, string> = {
  fort: 'Форт',
  gate: 'Ворота',
  tower: 'Укрепление',
  landmark: 'Достопримечательность',
  castle: 'Замок',
  beach: 'Пляж',
  town: 'Город',
  food: 'Еда',
}

export function yandexRouteUrl(lat: number, lon: number) {
  return `https://yandex.ru/maps/?rtext=~${lat}%2C${lon}&rtt=mt`
}

export function touristAttraction(place: PlacePageModel, origin = 'https://k39.online') {
  return {
    '@type': 'TouristAttraction' as const,
    'name': place.title,
    'description': place.description,
    'url': `${origin}/place/${place.slug}`,
    'geo': {
      '@type': 'GeoCoordinates' as const,
      'latitude': place.lat,
      'longitude': place.lon,
    },
  }
}

export function toPlacePage(doc: Record<string, unknown>): PlacePageModel {
  const status = doc.status
  if (status !== 'open' && status !== 'ruins' && status !== 'unknown') {
    throw new Error('Place status is missing')
  }
  return {
    title: String(doc.title ?? ''),
    description: String(doc.description ?? ''),
    slug: String(doc.slug ?? ''),
    placeType: String(doc.placeType ?? ''),
    status,
    statusLabel: String(doc.statusLabel ?? STATUS_TITLE[status]),
    hours: doc.hours ? String(doc.hours) : null,
    hoursNote: doc.hoursNote ? String(doc.hoursNote) : null,
    nameNote: doc.nameNote ? String(doc.nameNote) : null,
    germanName: doc.germanName ? String(doc.germanName) : null,
    lat: Number(doc.lat),
    lon: Number(doc.lon),
    sourceName: String(doc.sourceName ?? ''),
    sourceUrl: String(doc.sourceUrl ?? ''),
    how: doc.how ? String(doc.how) : null,
    mapId: doc.mapId ? String(doc.mapId) : null,
    region: String(doc.region ?? ''),
  }
}
