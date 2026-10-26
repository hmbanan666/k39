// The VK community id field in the admin venue form (ADR 0048). The writer
// repeats these checks; the form names the problem before the request.

import { parseVkCommunityId, vkCommunityIdProblem, vkSocialLinks } from '@k39/types/vk-community'

export interface VkCommunityField {
  /** No VK link in socials: there is nothing for the id to belong to. */
  disabled: boolean
  /** Ids the VK links already carry (`club`, `public`, `event`, `album-`…). */
  impliedIds: number[]
  /** Screen-name links, shown so the editor knows which community this is. */
  screenNames: string[]
  error: string | null
  /** What PATCH sends: a number, null to clear, or undefined when the value is invalid. */
  value: number | null | undefined
}

export function vkCommunityField(input: string, socials: ReadonlyArray<{ url: string }>): VkCommunityField {
  const vk = vkSocialLinks(socials)
  const base = {
    disabled: vk.links === 0,
    impliedIds: vk.communityIds,
    screenNames: vk.names,
  }
  const parsed = parseVkCommunityId(input)
  if (parsed === 'invalid') {
    return {
      ...base,
      error: 'Только цифры, без club и минуса: из vk.com/album-236300695_1 нужно 236300695',
      value: undefined,
    }
  }
  const problem = vkCommunityIdProblem(parsed, socials)
  if (problem === 'no_vk_link') {
    return { ...base, error: 'Сначала добавьте ссылку на сообщество ВКонтакте в «Соцсети»', value: undefined }
  }
  if (problem === 'mismatch') {
    const error = vk.communityIds.length
      ? `Ссылки в «Соцсети» уже дают ID ${vk.communityIds.join(', ')}. Другое число не сохранится`
      : 'Ссылка ВКонтакте в «Соцсети» ведёт не на сообщество'
    return { ...base, error, value: undefined }
  }
  return { ...base, error: null, value: parsed }
}
