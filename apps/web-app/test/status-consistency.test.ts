import { describe, expect, it } from 'vitest'
import { statusContradictions } from '../shared/status-consistency'

describe('status consistency', () => {
  it('flags closed text with open hours', () => {
    expect(statusContradictions({ text: 'Бастион закрыт на реставрацию.', mode: 'hours' })).toHaveLength(1)
    expect(statusContradictions({ text: 'Бастион закрыт на реставрацию.', mode: 'closed' })).toEqual([])
  })
  it('accepts military closures and ignores neighbours', () => {
    expect(statusContradictions({ text: 'Военный объект, посещение невозможно. Рядом [форт № 5а](/fort-5a), туда пускают по записи.', mode: 'closed' })).toEqual([])
  })
  it('ignores a weekly day off', () => {
    expect(statusContradictions({ text: 'По понедельникам закрыто.', mode: 'hours' })).toEqual([])
  })
  it('needs booking words for appointment mode', () => {
    expect(statusContradictions({ text: 'Экскурсии по предварительной записи.', mode: 'appointment' })).toEqual([])
    expect(statusContradictions({ text: 'Красивая кирха.', mode: 'appointment' })).toHaveLength(1)
  })
})
