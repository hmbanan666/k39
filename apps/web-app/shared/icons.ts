/**
 * Single map from a site key to a Tabler icon name (no collection prefix).
 * UI uses `tablerIcon()`. Map pins rasterize the same name.
 */
export const TABLER_ICONS = {
  forty: 'building-castle',
  zamki: 'building-fortress',
  plyazhi: 'beach',
  muzei: 'building-bank',
  tserkvi: 'building-church',
  kurorty: 'sun',
  coffee: 'coffee',
  cafe: 'cup',
  restaurant: 'tools-kitchen-2',
  bakery: 'bread',
  bar: 'glass-full',
  market: 'basket',
  fastfood: 'burger',
  other: 'tools-kitchen-2',
  eda: 'tools-kitchen-2',
  sights: 'building-bank',
  food: 'tools-kitchen-2',
  beaches: 'beach',
  routes: 'route',
  search: 'search',
  back: 'chevron-left',
  close: 'chevron-left',
  open: 'chevron-right',
  dismiss: 'x',
  zoomIn: 'plus',
  zoomOut: 'minus',
  locate: 'current-location',
  fit: 'focus-2',
  fullscreen: 'arrows-maximize',
  hours: 'clock',
  price: 'ticket',
  address: 'map-pin',
  coordinates: 'compass',
} as const

export type IconKey = keyof typeof TABLER_ICONS

export function tablerName(key: string) {
  return TABLER_ICONS[key as IconKey] ?? TABLER_ICONS.other
}

export function tablerIcon(key: string) {
  return `tabler:${tablerName(key)}`
}

export function tablerIconList() {
  return [...new Set(Object.values(TABLER_ICONS))].map((name) => `tabler:${name}`)
}
