import { describe, expect, it } from 'vitest'
import { questRoutePath, questStepCards } from '../shared/quest-page'

describe('quest page', () => {
  it('links each stop to its place and keeps the task text', () => {
    expect(
      questStepCards([
        {
          slug: 'fort-5-korol-fridrih-vilgelm-iii',
          title: 'Форт № 5',
          prompt: '  Найдите табличку у входа.  ',
          categorySlug: 'forty',
        },
        { slug: 'fort-11-denhoff', title: 'Форт № 11 «Дёнхофф»', prompt: null, categorySlug: null },
      ]),
    ).toEqual([
      {
        href: '/fort-5-korol-fridrih-vilgelm-iii',
        title: 'Форт № 5',
        task: 'Найдите табличку у входа.',
        label: 'Шаг 1',
        kind: 'forty',
      },
      {
        href: '/fort-11-denhoff',
        title: 'Форт № 11 «Дёнхофф»',
        task: '',
        label: 'Шаг 2',
        kind: '',
      },
    ])
    expect(questRoutePath('pyat-fortov')).toBe('/marshruty/pyat-fortov')
    expect(questRoutePath('  ')).toBeNull()
    expect(questRoutePath(null)).toBeNull()
  })
})
