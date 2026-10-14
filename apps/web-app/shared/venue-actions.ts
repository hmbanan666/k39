// Venue page actions (ADR 0018). The first available one is the primary
// button: booking, then online order, then delivery, then a call. A link is
// shown only when the venue has it; nothing is guessed.

export interface VenueActionInput {
  bookingUrl?: string | null
  orderUrl?: string | null
  deliveryUrl?: string | null
  phone?: string | null
  menuUrl?: string | null
  website?: string | null
}

export interface VenueAction {
  key: 'booking' | 'order' | 'delivery' | 'phone' | 'menu' | 'website'
  label: string
  href: string
  external: boolean
}

export function telHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : ''
}

export function venueActions(input: VenueActionInput): { primary: VenueAction | null, secondary: VenueAction[] } {
  const all: VenueAction[] = []
  if (input.bookingUrl) {
    all.push({ key: 'booking', label: 'Забронировать столик', href: input.bookingUrl, external: true })
  }
  if (input.orderUrl) {
    all.push({ key: 'order', label: 'Заказать онлайн', href: input.orderUrl, external: true })
  }
  if (input.deliveryUrl) {
    all.push({ key: 'delivery', label: 'Доставка', href: input.deliveryUrl, external: true })
  }
  const tel = input.phone ? telHref(input.phone) : ''
  if (tel) {
    all.push({ key: 'phone', label: 'Позвонить', href: tel, external: false })
  }
  const extras: VenueAction[] = []
  if (input.menuUrl) {
    extras.push({ key: 'menu', label: 'Меню', href: input.menuUrl, external: true })
  }
  if (input.website && ![...all, ...extras].some((item) => item.href === input.website)) {
    extras.push({ key: 'website', label: 'Сайт', href: input.website, external: true })
  }
  const [primary = null, ...rest] = all
  return { primary, secondary: [...rest, ...extras] }
}

const RESERVATION_NOTE: Record<string, string> = {
  required: 'Только по брони',
  recommended: 'Лучше бронировать',
  yes: 'Можно забронировать',
  no: 'Без брони',
}

/** Short service facts, only the known ones. */
export function venueServiceNotes(input: { reservation?: string | null, takeaway?: boolean | null, delivery?: boolean | null }) {
  const notes: string[] = []
  if (input.reservation && RESERVATION_NOTE[input.reservation]) {
    notes.push(RESERVATION_NOTE[input.reservation]!)
  }
  if (input.takeaway === true) {
    notes.push('Еда навынос')
  }
  if (input.delivery === true) {
    notes.push('Есть доставка')
  }
  return notes
}

const SOCIAL_LABEL: Record<string, string> = {
  vk: 'ВКонтакте',
  telegram: 'Телеграм',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  youtube: 'YouTube',
  ok: 'Одноклассники',
}

export function socialLabel(network: string) {
  return SOCIAL_LABEL[network] ?? network
}
