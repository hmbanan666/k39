/**
 * Single map from a site key to a Tabler icon name (no collection prefix).
 * UI uses `tablerIcon()`. Map pins rasterize the same name.
 */
export const TABLER_ICONS = {
  'forty': 'building-castle',
  'zamki': 'building-fortress',
  'plyazhi': 'beach',
  'muzei': 'building-bank',
  'tserkvi': 'building-church',
  'kurorty': 'sun',
  'coffee': 'coffee',
  'cafe': 'cup',
  'restaurant': 'tools-kitchen-2',
  'bakery': 'bread',
  'bar': 'glass-full',
  'market': 'basket',
  'fastfood': 'burger',
  'other': 'tools-kitchen-2',
  'eda': 'tools-kitchen-2',
  'sights': 'building-bank',
  'food': 'tools-kitchen-2',
  'beaches': 'beach',
  'routes': 'route',
  'search': 'search',
  'back': 'chevron-left',
  'close': 'chevron-left',
  'open': 'chevron-right',
  'dismiss': 'x',
  'zoomIn': 'plus',
  'zoomOut': 'minus',
  'locate': 'current-location',
  'fit': 'focus-2',
  'fullscreen': 'arrows-maximize',
  'hours': 'clock',
  'closed': 'calendar-x',
  'price': 'ticket',
  'address': 'map-pin',
  'coordinates': 'compass',
  'duration': 'hourglass',
  'season': 'calendar-event',
  'checked': 'circle-check',
  'phone': 'phone',
  'cuisine': 'chef-hat',
  'website': 'world',
  'booking': 'calendar-check',
  'menu': 'book-2',
  'service': 'paper-bag',
  'social': 'message-circle',
  'takeaway': 'paper-bag',
  'terrace': 'armchair',
  'kids': 'baby-carriage',
  'payment': 'credit-card',
  'wifi': 'wifi',
  'dogs': 'dog',
  'parking': 'parking',
  'aud-group': 'users-group',
  'aud-family': 'users',
  'aud-kids': 'baby-carriage',
  'aud-couple': 'heart',
  'aud-solo': 'user',
  'aud-friends': 'glass-full',
  'aud-beach': 'beach',
  'aud-day-trip': 'train',
  'aud-tourist': 'backpack',
  'aud-local': 'home',
  'aud-pets': 'dog',
  'aud-work': 'device-laptop',
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
