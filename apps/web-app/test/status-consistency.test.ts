import { describe, expect, it } from 'vitest'
import { statusChecks, statusContradictions } from '../shared/status-consistency'

const ROSGARTEN_BODY = 'Фасад доступен для осмотра круглосуточно, а ресторан «Солнечный камень» внутри, по данным Яндекс Карт, временно не работает.'
const ROSGARTEN_FAQ = [{
  question: 'Можно ли поесть внутри?',
  answer: 'Сейчас нет: ресторан в казематах временно не работает.',
}]

describe('status consistency', () => {
  it('flags closed text with open hours', () => {
    expect(statusContradictions({ text: 'Бастион закрыт на реставрацию.', mode: 'hours' })).toHaveLength(1)
    expect(statusContradictions({ text: 'Бастион закрыт на реставрацию.', mode: 'closed' })).toEqual([])
  })
  it('accepts military closures and ignores neighbours', () => {
    expect(statusContradictions({ text: 'Военный объект, посещение невозможно. Рядом [форт № 5а](/fort-5a), туда пускают по записи.', mode: 'closed' })).toEqual([])
  })
  it('reads outside-only wording as closed', () => {
    expect(statusContradictions({ text: 'Не открыт для посещения; осмотр только снаружи', mode: 'closed' })).toEqual([])
    expect(statusContradictions({ text: 'Внутрь ворот не пускают, музея пока нет.', mode: 'hours' })).toHaveLength(1)
  })
  it('ignores a weekly day off', () => {
    expect(statusContradictions({ text: 'По понедельникам закрыто.', mode: 'hours' })).toEqual([])
  })
  it('needs booking words for appointment mode', () => {
    expect(statusContradictions({ text: 'Экскурсии по предварительной записи.', mode: 'appointment' })).toEqual([])
    expect(statusContradictions({ text: 'Красивая кирха.', mode: 'appointment' })).toHaveLength(1)
  })

  it('ignores a tenant or a quoted name named before the closure', () => {
    expect(statusChecks({ text: ROSGARTEN_BODY, mode: 'always', faq: ROSGARTEN_FAQ })).toEqual({
      contradictions: [],
      warnings: [],
    })
    for (const sentence of [
      'Кафе временно не работает.',
      'Магазин временно закрыт.',
      'Выставка временно закрыта.',
      'Экспозиция временно не работает.',
      'Музей внутри временно закрыт.',
      '«Солнечный камень» временно не работает.',
    ]) {
      expect(statusContradictions({ text: sentence, mode: 'always' })).toEqual([])
    }
  })

  it('still flags a closure about the place itself', () => {
    const found = statusChecks({ text: 'Ворота временно закрыты на реставрацию.', mode: 'always' })
    expect(found.contradictions).toEqual(['text says closed, schedule mode is always'])
    expect(found.warnings).toEqual([])
    expect(statusContradictions({
      text: 'Ресторан временно закрыт. Ворота временно закрыты на реставрацию.',
      mode: 'always',
    })).toHaveLength(1)
  })

  it('warns when the other subject is only named after the phrase', () => {
    expect(statusChecks({ text: 'Временно закрыт ресторан внутри.', mode: 'always' })).toEqual({
      contradictions: [],
      warnings: ['closure may refer to another subject'],
    })
    expect(statusContradictions({ text: 'Временно закрыт ресторан внутри.', mode: 'closed' })).toEqual([
      'schedule closed, text does not say so',
    ])
  })

  it('reads each FAQ answer as a sentence, not as one JSON blob', () => {
    const faq = [
      { question: 'Ресторан?', answer: 'Ресторан «Солнечный камень» временно не работает.' },
      { question: 'Ворота?', answer: 'Ворота временно закрыты на реставрацию.' },
    ]
    expect(statusContradictions({ text: 'Фасад открыт.', mode: 'always', faq })).toHaveLength(1)
    expect(statusContradictions({ text: JSON.stringify(faq), mode: 'always' })).toEqual([])
  })
})
