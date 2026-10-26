import type { LengthOverride, LengthOverrideInput } from '../shared/length-override'
import { describe, expect, it } from 'vitest'
import { passportWriteSchema } from '../server/utils/scoring/schemas'
import {
  lengthJustificationValid,
  lengthOverrideApplies,
  lengthOverrideIsStale,
  lengthOverrideRejection,
  longPageFiller,
  stampLengthOverride,
} from '../shared/length-override'
import { searchTotalsForPath } from '../shared/scoring'

const now = new Date('2026-10-16T00:00:00.000Z')

function input(patch: Partial<LengthOverrideInput> = {}): LengthOverrideInput {
  return {
    ceiling: 12_000,
    queries: ['форт 11'],
    search: { impressions: 40, position: 8.5 },
    sections: ['История', 'Как добраться'],
    ...patch,
  }
}

function stored(patch: Partial<LengthOverride> = {}): LengthOverride {
  return {
    ...input(),
    search: { impressions: 40, position: 8.5 },
    competitors: [],
    setAt: '2026-08-01T00:00:00.000Z',
    ...patch,
  }
}

const copied =
  'Во дворе слышно шоссе круглый год, билет покупают у кассы у ворот, а стены сложены из красного кирпича в конце девятнадцатого века и стоят на своём месте до сих пор без новой облицовки.'

describe('length override justification', () => {
  it('accepts impressions or competitor lengths, and refuses a bare ceiling', () => {
    expect(lengthJustificationValid(input())).toBe(true)
    expect(
      lengthJustificationValid(
        input({
          search: null,
          competitors: [{ query: 'форт 11', chars: 14_000 }],
        }),
      ),
    ).toBe(true)
    expect(lengthJustificationValid(input({ search: null }))).toBe(false)
    expect(lengthJustificationValid(input({ search: { impressions: 0, position: 3 } }))).toBe(false)
    expect(lengthJustificationValid(input({ sections: [] }))).toBe(false)
    expect(lengthJustificationValid(input({ ceiling: 20_001 }))).toBe(false)
    expect(lengthOverrideRejection(6000, input({ ceiling: 6000 }))).toMatch(/выше 6000/)
    expect(lengthOverrideRejection(6000, input({ ceiling: 20_001 }))).toBe('Потолок не больше 20000')
    expect(lengthOverrideRejection(6000, input())).toBeNull()
  })

  it('parses a passport write and rejects an override without evidence', () => {
    expect(passportWriteSchema.safeParse({ path: '/fort-a', lengthOverride: input() }).success).toBe(true)
    expect(passportWriteSchema.safeParse({ path: '/fort-a', lengthOverride: null }).success).toBe(true)
    expect(
      passportWriteSchema.safeParse({
        path: '/fort-a',
        lengthOverride: { ceiling: 12_000, queries: ['форт'], sections: ['История'] },
      }).success,
    ).toBe(false)
  })

  it('keeps setAt when the justification is unchanged', () => {
    const previous = stored()
    const again = stampLengthOverride({ ...input(), queries: ['  форт 11  '] }, previous, now)
    expect(again?.setAt).toBe(previous.setAt)
    const changed = stampLengthOverride(input({ sections: ['Только история'] }), previous, now)
    expect(changed?.setAt).toBe(now.toISOString())
    expect(stampLengthOverride(null, previous, now)).toBeNull()
  })

  it('applies a ceiling above the default and ignores a broken one', () => {
    expect(lengthOverrideApplies(stored({ ceiling: 12_000 }), 6000)?.ceiling).toBe(12_000)
    expect(lengthOverrideApplies(stored({ ceiling: 6000 }), 6000)).toBeNull()
    expect(lengthOverrideApplies(stored({ ceiling: 25_000 }), 6000)).toBeNull()
    expect(lengthOverrideApplies({ ...stored(), setAt: '' }, 6000)).toBeNull()
  })

  it('flags a stale override only after 60 days without imported impressions', () => {
    const fresh = stored({ setAt: new Date(now.getTime() - 59 * 86_400_000).toISOString() })
    const aged = stored({ setAt: new Date(now.getTime() - 60 * 86_400_000).toISOString() })
    expect(lengthOverrideIsStale(fresh, now, true, 0)).toBe(false)
    expect(lengthOverrideIsStale(aged, now, true, 0)).toBe(true)
    expect(lengthOverrideIsStale(aged, now, true, 4)).toBe(false)
    expect(lengthOverrideIsStale(aged, now, false, 0)).toBe(false)
  })
})

describe('long page filler', () => {
  it('flags a copied section, a copied paragraph, and a stop-list phrase', () => {
    const text = `## Двор\n\n${copied}\n\n## Двор снова\n\n${copied}`
    const checks = longPageFiller(text).checks
    expect(checks).toContain('repeated section: Двор снова')
    expect(checks).toContain('repeated paragraph')
    expect(
      longPageFiller(`${copied}\n\nЭто уютная атмосфера у форта и больше ничего нового в этом абзаце нет.`).checks,
    ).toContain('stop-list: уютная атмосфера')
  })

  it('leaves two different sections alone', () => {
    const left = Array.from(
      { length: 8 },
      (_, index) => `Ров ${index} сложен из кирпича ${1800 + index} года и выходит к западному валу форта.`,
    ).join(' ')
    const right = Array.from(
      { length: 8 },
      (_, index) => `Маяк ${index} стоит на косе с ${1900 + index} года и светит в сторону моря после заката.`,
    ).join(' ')
    expect(longPageFiller(`## Ров\n\n${left}\n\n## Маяк\n\n${right}`).checks).toEqual([])
  })
})

describe('search totals', () => {
  it('sums impressions for this page and a site-wide target, not another page', () => {
    const totals = searchTotalsForPath(
      '/fort-a',
      [
        { page: '/fort-a', query: 'форт а', impressions: 4, clicks: 1 },
        { page: 'https://k39.online/fort-a/', query: 'форт а', impressions: 6, clicks: 2 },
        { page: '/other', query: 'форт а', impressions: 100, clicks: 9 },
        { page: '', query: 'билеты в форт', impressions: 3, clicks: 1 },
        { page: '', query: 'погода', impressions: 50, clicks: 5 },
      ],
      ['Билеты в форт'],
    )
    expect(totals).toEqual({ queries: ['форт а', 'билеты в форт'], impressions: 13, clicks: 4 })
  })
})
