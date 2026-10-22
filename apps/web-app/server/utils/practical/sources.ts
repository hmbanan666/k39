import { classifyMenuUrl } from '../../../shared/price-compare'

/** Ticket sellers, listings, and travel sites. They are not the place's own page. */
const TICKET_AGGREGATORS = [
  'afisha.ru',
  'kassir.ru',
  'ticketland.ru',
  'radario.ru',
  'kassy.ru',
  'culture.ru',
  'kudago.com',
  'tripadvisor.ru',
  'tripadvisor.com',
  'tripster.ru',
  'sputnik8.com',
  'izi.travel',
  'tutu.ru',
]

function hostOf(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function isTicketAggregator(url: string | null | undefined) {
  const host = hostOf(url || '')
  return Boolean(host) && TICKET_AGGREGATORS.some((site) => host === site || host.endsWith(`.${site}`))
}

/**
 * The official site of the place, the museum, or the administration.
 * A map card, an aggregator, a social page, and a document host are refused.
 */
export function admissionSourceProblem(url: string | null | undefined): string | null {
  const kind = classifyMenuUrl(url)
  if (kind === 'invalid') {
    return 'Источник цены билета: нужна ссылка http(s)'
  }
  if (kind !== 'menu' || isTicketAggregator(url)) {
    return 'Источник цены билета: только официальный сайт места, музея или администрации. Карты, агрегаторы, соцсети и документы на Диске не подходят'
  }
  return null
}

/** The official page of the place or its own social page. A listing site is not the source. */
export function eventSourceProblem(url: string) {
  const kind = classifyMenuUrl(url)
  if ((kind !== 'menu' && kind !== 'social') || isTicketAggregator(url)) {
    return 'Источник события: официальный сайт или официальная страница места. Афиша-агрегатор, карта и документ на Диске не подходят'
  }
  return null
}

export function ticketUrlProblem(url: string | null | undefined) {
  if (!url) {
    return null
  }
  if (!url.startsWith('https://')) {
    return 'ticketUrl: только https'
  }
  const kind = classifyMenuUrl(url)
  if (kind === 'map' || kind === 'invalid') {
    return 'ticketUrl: ссылка на продавца билетов, на которого ссылается официальная страница'
  }
  return null
}
