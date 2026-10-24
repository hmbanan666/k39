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
  it.each([
    'Закрытую обувь, которая не боится сырости, фонарь и заряженный телефон.',
    'Закрытый двор виден с улицы.',
    'Закрытая веранда находится слева.',
    'Закрытые казематы видны со двора.',
    'Закрытого помещения для отдыха нет.',
    'Закрытым проходом соединены два зала.',
    'Закрытость территории относится к прошлому.',
  ])('does not treat an adjective or noun prefix as a closure: %s', (text) => {
    expect(statusChecks({ text, mode: 'always' })).toEqual({ contradictions: [], warnings: [] })
    expect(statusChecks({ text: '', faq: [{ answer: text }], mode: 'always' })).toEqual({ contradictions: [], warnings: [] })
    expect(statusContradictions({ text, mode: 'closed' })).toEqual(['schedule closed, text does not say so'])
  })
  it.each(['Закрыт.', 'Закрыта: идут работы.', 'ЗАКРЫТО!', 'Закрыты до конца работ.'])('keeps the complete closure word: %s', (text) => {
    expect(statusContradictions({ text, mode: 'always' })).toEqual(['text says closed, schedule mode is always'])
    expect(statusContradictions({ text, mode: 'closed' })).toEqual([])
  })
  it('needs booking words for appointment mode', () => {
    expect(statusContradictions({ text: 'Экскурсии по предварительной записи.', mode: 'appointment' })).toEqual([])
    expect(statusContradictions({ text: 'Красивая кирха.', mode: 'appointment' })).toHaveLength(1)
  })

  it.each([
    { title: 'Кирха', text: 'Кирха рядом с музеем доступна по записи.', own: true },
    { title: 'Музей «Бланкенштайн»', text: 'Ресторан музея принимает по записи.', own: false },
  ].flatMap((test) => ['always', 'appointment'].map((mode) => ({ ...test, mode }))))('keeps noun complements from replacing the subject ($mode): $text', ({ title, text, own, mode }) => {
    const expected = mode === 'always'
      ? own ? ['text says by appointment, schedule is always open'] : []
      : own ? [] : ['schedule by appointment, text does not say how to book']
    expect(statusContradictions({ title, text, mode })).toEqual(expected)
    expect(statusContradictions({ title, text: '', mode, faq: [{ question: 'Как попасть внутрь?', answer: text }] })).toEqual(expected)
  })

  it.each([
    { title: 'Кирха', text: 'Кирха рядом с новым кафе доступна по записи.', own: true },
    { title: 'Кирха', text: 'Кирха, рядом с музеем, доступна по записи.', own: true },
    { title: 'Кирха', text: 'Кирха рядом с музеем «Бланкенштайн» доступна по записи.', own: true },
    { title: 'Кирха', text: 'Кирха рядом с «Бланкенштайном» доступна по записи.', own: true },
    { title: 'Кирха', text: 'По записи доступна Кирха рядом с музеем.', own: true },
    { title: 'Музей «Бланкенштайн»', text: 'Ресторан музея «Бланкенштайн» принимает по записи.', own: false },
    { title: 'Музей «Бланкенштайн»', text: 'Ресторан «Окно» принимает по записи.', own: false },
    { title: 'Музей «Бланкенштайн»', text: 'По записи принимает ресторан музея.', own: false },
    { title: 'Музей «Бланкенштайн»', text: 'Кафе музея принимает по записи.', own: false },
    { title: 'Музей «Бланкенштайн»', text: 'Музей возле ресторана «Окно» принимает по записи.', own: true },
    { title: 'Кафе «Башня»', text: 'Ресторан кафе «Башня» принимает по записи.', own: false },
    { title: 'Полесск', text: 'Полесск открыт круглосуточно, музей принимает по записи.', own: false },
  ])('keeps bounded complement and quoted-name attribution: $text', ({ title, text, own }) => {
    for (const mode of ['always', 'appointment']) {
      const expected = mode === 'always'
        ? own ? ['text says by appointment, schedule is always open'] : []
        : own ? [] : ['schedule by appointment, text does not say how to book']
      expect(statusContradictions({ title, text, mode })).toEqual(expected)
      expect(statusContradictions({ title, text: '', mode, faq: [{ answer: text }] })).toEqual(expected)
    }
  })

  it('keeps FAQ complement context on its tenant rather than the museum', () => {
    const faq = [{ question: 'Как попасть в кафе музея «Бланкенштайн»?', answer: 'Принимает по записи.' }]
    expect(statusContradictions({ title: 'Музей «Бланкенштайн»', text: '', mode: 'always', faq })).toEqual([])
    expect(statusContradictions({ title: 'Музей «Бланкенштайн»', text: '', mode: 'appointment', faq })).toEqual(['schedule by appointment, text does not say how to book'])
  })

  it.each([
    'Пивоварня принимает по предварительной записи.',
    'Конный завод принимает по записи.',
    'Музей открывает подвалы по заявке.',
    'В Полесске музей принимает по записи.',
    'Полесск открыт круглосуточно, а музей принимает по записи.',
    'Ресторан «Бланкенштайн» принимает по договорённости.',
    '«Бланкенштайн» принимает по записи.',
    'По записи принимает музей «Бланкенштайн».',
    'Рядом [музей](/museum), туда пускают по записи.',
  ])('does not attribute another attraction booking to the page: %s', (text) => {
    expect(statusContradictions({ title: 'Полесск', text, mode: 'always' })).toEqual([])
    expect(statusContradictions({ title: 'Полесск', text, mode: 'appointment' })).toEqual(['schedule by appointment, text does not say how to book'])
  })

  it.each([
    { title: 'Полесск', text: 'Сам Полесск доступен по записи.' },
    { title: 'Полесск', text: 'Музей открыт, а сам Полесск доступен по записи.' },
    { title: 'Полесск', text: 'Сам Полесск доступен по записи, а музей открыт.' },
    { title: 'Полесск', text: 'Музей принимает по записи. Сам Полесск тоже доступен по записи.' },
    { title: 'Музей «Бланкенштайн»', text: 'Музей «Бланкенштайн» принимает по записи.' },
    { title: 'Музей «Бланкенштайн»', text: 'Музей принимает по записи.' },
    { title: 'Пивоварня «Бланкенштайн»', text: 'Пивоварня принимает по записи.' },
    { title: 'Конный завод', text: 'Конный завод принимает по записи.' },
    { title: 'Ресторан «Башня»', text: 'Ресторан «Башня» принимает по записи.' },
    { title: 'Форт №5', text: 'Форт №5 «Король Фридрих Вильгельм III» доступен по записи.' },
    { title: 'Кирха', text: 'Вход по предварительной записи.' },
  ])('retains own-subject booking contradictions: $text', ({ title, text }) => {
    expect(statusContradictions({ title, text, mode: 'always' })).toEqual(['text says by appointment, schedule is always open'])
    expect(statusContradictions({ title, text, mode: 'appointment' })).toEqual([])
  })

  it('uses FAQ question context without letting one answer hide another', () => {
    const brewery = {
      question: 'Как посетить пивоварню «Бланкенштайн»?',
      answer: 'Ул. Рабочая, 5, ежедневно с 11:00 до 18:00, экскурсии по записи.',
    }
    expect(statusContradictions({ title: 'Полесск', text: '', mode: 'always', faq: [brewery] })).toEqual([])
    expect(statusContradictions({ title: 'Полесск', text: '', mode: 'appointment', faq: [brewery] })).toHaveLength(1)
    const own = { question: 'Как попасть в Полесск?', answer: 'Вход по записи.' }
    expect(statusContradictions({ title: 'Полесск', text: '', mode: 'always', faq: [brewery, own] })).toHaveLength(1)
    expect(statusContradictions({ title: 'Полесск', text: '', mode: 'appointment', faq: [brewery, own] })).toEqual([])
    expect(statusContradictions({ title: 'Полесск', text: '', mode: 'always', faq: [{ ...brewery, answer: 'Сам Полесск доступен по записи.' }] })).toHaveLength(1)
    expect(statusContradictions({ title: 'Полесск', text: '', mode: 'always', faq: [{ ...brewery, answer: 'Сам город доступен по записи.' }] })).toHaveLength(1)
    expect(statusContradictions({ title: 'Музей «Бланкенштайн»', text: '', mode: 'always', faq: [{ question: 'Нужна запись?', answer: 'Музей принимает по записи' }] })).toHaveLength(1)
  })

  it('ignores a tenant or a quoted name named before the closure', () => {
    expect(statusChecks({
      text: ROSGARTEN_BODY,
      mode: 'always',
      faq: ROSGARTEN_FAQ,
      title: 'Росгартенские ворота',
    })).toEqual({
      contradictions: [],
      warnings: [],
    })
    expect(statusChecks({
      text: 'Ресторан «Розенгартен» внутри временно закрыт.',
      mode: 'always',
      title: 'Росгартенские ворота',
    })).toEqual({ contradictions: [], warnings: [] })
    for (const sentence of [
      'Кафе временно не работает.',
      'Магазин временно закрыт.',
      'Выставка временно закрыта.',
      'Экспозиция временно не работает.',
      'Музей внутри временно закрыт.',
    ]) {
      expect(statusContradictions({ text: sentence, mode: 'always' })).toEqual([])
    }
  })

  it('warns on a quoted name that is not the title and not a tenant', () => {
    expect(statusChecks({
      text: '«Солнечный камень» временно не работает.',
      mode: 'always',
      title: 'Росгартенские ворота',
    })).toEqual({
      contradictions: [],
      warnings: ['closure may refer to another subject'],
    })
  })

  it('charges a historic name quoted inside this page\'s title', () => {
    const found = statusChecks({
      text: 'Форт №5 «Король Фридрих Вильгельм III» сейчас закрыт для посещения.',
      mode: 'always',
      title: 'Форт №5',
    })
    expect(found.warnings).toEqual([])
    expect(found.contradictions).toEqual(['text says closed, schedule mode is always'])
  })

  it('flags a closure of this place when the quoted name is the title', () => {
    const cases = [
      {
        title: 'Музей «Фридландские ворота»',
        text: 'Музей «Фридландские ворота» временно закрыт на реставрацию.',
      },
      {
        title: 'Форт №5 «Король Фридрих Вильгельм III»',
        text: 'Форт №5 «Король Фридрих Вильгельм III» сейчас закрыт для посещения.',
      },
      {
        title: 'Кирха «Юдиттен»',
        text: 'Фасад на месте.',
        faq: [{ question: 'Идёт ремонт?', answer: 'Да, кирха «Юдиттен» сейчас закрыта на реставрацию' }],
      },
      {
        title: 'Башня',
        text: 'Выставка завершилась, а сама башня временно закрыта на ремонт.',
      },
      {
        title: 'Здание биржи',
        text: 'Здание временно закрыто на ремонт, работает только кафе на первом этаже.',
      },
      {
        title: 'Башня',
        text: 'Закрыт на реконструкцию до 2027 года, кафе «Башня» тоже не работает.',
      },
    ]
    for (const item of cases) {
      expect(statusChecks({
        text: item.text,
        mode: 'always',
        title: item.title,
        faq: item.faq,
      }).contradictions).toEqual(['text says closed, schedule mode is always'])
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
