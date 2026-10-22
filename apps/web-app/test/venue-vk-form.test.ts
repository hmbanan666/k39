import { describe, expect, it } from 'vitest'
import { vkCommunityField } from '../shared/venue-vk-form'

const screenName = [{ url: 'https://vk.com/lugowen_gastro' }]

describe('admin VK community id field', () => {
  it('accepts digits beside a screen-name link and sends a number', () => {
    const field = vkCommunityField(' 236300695 ', screenName)
    expect(field).toMatchObject({ disabled: false, error: null, value: 236300695, screenNames: ['lugowen_gastro'], impliedIds: [] })
  })

  it('sends null to clear an empty field', () => {
    expect(vkCommunityField('', screenName)).toMatchObject({ error: null, value: null })
    expect(vkCommunityField('', [])).toMatchObject({ disabled: true, error: null, value: null })
  })

  it('rejects a value that is not a positive integer', () => {
    for (const bad of ['club236300695', '-236300695', '0', '12.5', 'abc', '9007199254740992']) {
      const field = vkCommunityField(bad, screenName)
      expect(field.value).toBeUndefined()
      expect(field.error).toBe('Только цифры, без club и минуса: из vk.com/album-236300695_1 нужно 236300695')
    }
  })

  it('needs a VK link in socials', () => {
    const field = vkCommunityField('236300695', [{ url: 'https://t.me/lugowen' }])
    expect(field.disabled).toBe(true)
    expect(field.error).toBe('Сначала добавьте ссылку на сообщество ВКонтакте в «Соцсети»')
  })

  it('shows the id a club link implies and refuses a different one', () => {
    const club = [{ url: 'https://vk.com/club71522139' }]
    expect(vkCommunityField('', club)).toMatchObject({ impliedIds: [71522139], error: null, value: null })
    expect(vkCommunityField('71522139', club)).toMatchObject({ error: null, value: 71522139 })
    expect(vkCommunityField('236300695', club).error).toBe('Ссылки в «Соцсети» уже дают ID 71522139. Другое число не сохранится')
    expect(vkCommunityField('5', [{ url: 'https://vk.com/id5' }]).error).toBe('Ссылка ВКонтакте в «Соцсети» ведёт не на сообщество')
  })
})
