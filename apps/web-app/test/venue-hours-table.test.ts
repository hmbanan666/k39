import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import VenueHoursTable from '../app/components/VenueHoursTable.vue'
import { scheduleRulesSchema, weeklyTableFits } from '../shared/schedule'
import { hoursFormState } from '../shared/venue-hours-form'

const seasonal = scheduleRulesSchema.parse({
  seasons: [
    { from: '06-01', to: '08-31', week: [{ days: [0, 1, 2, 3, 4, 5, 6], opens: '09:00', closes: '23:00' }] },
    { week: [{ days: [1, 2, 3, 4, 5], opens: '10:00', closes: '19:00' }] },
  ],
  closures: [{ weekday: 1, nth: -1 }],
  exceptions: [{ date: '2026-12-31', closed: true }],
})

function render(state: ReturnType<typeof hoursFormState>, owner = false) {
  return mount(VenueHoursTable, { props: { days: state.days, editable: state.editable, table: state.table, lines: state.lines, owner } })
}

describe('venue hours table', () => {
  it('shows seasonal rules read-only with the note, filled from the season of the day', () => {
    const state = hoursFormState(seasonal, '2026-10-22')
    expect(state.editable).toBe(false)
    const wrapper = render(state)
    const note = wrapper.get('[role="note"]')
    expect(note.text()).toContain('Здесь они только для просмотра')
    expect(note.text()).toContain('санитарный день')
    expect(wrapper.findAll('select').every((select) => select.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.findAll('input').every((input) => input.attributes('disabled') !== undefined)).toBe(true)
    expect((wrapper.get('input[aria-label="пн: открытие"]').element as HTMLInputElement).value).toBe('10:00')
    expect((wrapper.get('select[aria-label="вс: часы"]').element as HTMLSelectElement).value).toBe('closed')
    expect((render(hoursFormState(seasonal, '2026-07-01')).get('input[aria-label="вс: открытие"]').element as HTMLInputElement).value).toBe('09:00')
    expect(render(state, true).get('[role="note"]').text()).toContain('Изменить их может редакция')
  })

  it('keeps a plain weekly schedule editable with no note', () => {
    const state = hoursFormState(scheduleRulesSchema.parse({ seasons: [{ week: [{ days: [1], opens: '10:00', closes: '19:00' }] }], closures: [{ weekday: 1, nth: -1 }] }), '2026-10-22')
    expect(state.editable).toBe(true)
    const wrapper = render(state)
    expect(wrapper.find('[role="note"]').exists()).toBe(false)
    expect(wrapper.get('select[aria-label="пн: часы"]').attributes('disabled')).toBeUndefined()
  })

  it('treats breaks, a last entry, a dated season and a special mode as read-only', () => {
    const week = (entry: Record<string, unknown>) => scheduleRulesSchema.parse({ seasons: [{ week: [{ days: [1], opens: '10:00', closes: '19:00', ...entry }] }] })
    expect(weeklyTableFits(null)).toBe(true)
    expect(weeklyTableFits(week({}))).toBe(true)
    expect(weeklyTableFits(week({ breaks: [{ from: '13:00', to: '14:00' }] }))).toBe(false)
    expect(weeklyTableFits(week({ lastEntry: '18:00' }))).toBe(false)
    expect(weeklyTableFits(scheduleRulesSchema.parse({ seasons: [{ from: '05-01', to: '09-30', week: [] }] }))).toBe(false)
    expect(weeklyTableFits(scheduleRulesSchema.parse({ mode: 'appointment' }))).toBe(false)
    expect(weeklyTableFits(seasonal)).toBe(false)
  })

  it('hides the table for a mode a week cannot show', () => {
    const state = hoursFormState(scheduleRulesSchema.parse({ mode: 'always' }), '2026-10-22')
    expect(state).toMatchObject({ editable: false, table: false })
    const wrapper = render(state)
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.get('[role="note"]').text()).toContain('Круглосуточно')
  })
})
