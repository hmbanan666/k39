import { classifyOfficialUrl } from '@k39/types/official-url'
import { vkMenuMatchesSocial } from '@k39/types/vk-community'

/** The subject's own social links. Places have none, so a place event needs its official site. */
export interface OwnSocialLinks {
  socials: ReadonlyArray<{ url: string }>
  vkCommunityId?: number | null
}

/**
 * The official site of the place, the museum, or the administration.
 * A map card, a listing or ticket seller, a social page, and a document host are refused.
 */
export function admissionSourceProblem(url: string | null | undefined): string | null {
  const kind = classifyOfficialUrl(url)
  if (kind === 'invalid') {
    return 'Источник цены билета: нужна ссылка http(s)'
  }
  if (kind !== 'official') {
    return 'Источник цены билета: только официальный сайт места, музея или администрации. Карты, агрегаторы, соцсети и документы на Диске не подходят'
  }
  return null
}

/**
 * `official` for a page on the subject's own site. `official_social` for the
 * subject's own VK page, matched against its `socials` and `vkCommunityId` by
 * the same rule as a VK menu price. Anything else is null. The one source rule
 * for events (ADR 0046) and notices (ADR 0049); only their messages differ.
 */
export function ownOfficialSourceKind(url: string, own: OwnSocialLinks | null): 'official' | 'official_social' | null {
  const kind = classifyOfficialUrl(url)
  if (kind === 'official') {
    return 'official'
  }
  if (kind === 'social' && own && vkMenuMatchesSocial(url, own.socials, own.vkCommunityId)) {
    return 'official_social'
  }
  return null
}

export function eventSourceProblem(url: string, own: OwnSocialLinks | null) {
  if (ownOfficialSourceKind(url, own)) {
    return null
  }
  if (classifyOfficialUrl(url) === 'social') {
    return own
      ? 'Источник события: страница VK из «Соцсетей» этого заведения. Чужая или не указанная соцсеть не подходит'
      : 'Источник события: официальный сайт места. У места нет соцсетей в карточке'
  }
  return 'Источник события: официальный сайт или официальная страница VK заведения. Афиша-агрегатор, карта и документ на Диске не подходят'
}

export function ticketUrlProblem(url: string | null | undefined) {
  if (!url) {
    return null
  }
  if (!url.startsWith('https://')) {
    return 'ticketUrl: только https'
  }
  const kind = classifyOfficialUrl(url)
  if (kind === 'map' || kind === 'invalid') {
    return 'ticketUrl: ссылка на продавца билетов, на которого ссылается официальная страница'
  }
  return null
}
