import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import GuestBlock from '../app/components/GuestBlock.vue'
import GuestsAdmin from '../app/pages/admin/guests.vue'
import { limitGuestPhoto, limitGuestSubmit, resetCabinetSlots } from '../server/utils/cabinet/rate'
import { license } from '../server/utils/mcp/schemas'
import { GUEST_CONSENT_PATH, GUEST_CONSENT_VERSION } from '../shared/consent'
import { priorityFor } from '../shared/facts'
import {
  guestByline,
  guestDay,
  guestParts,
  guestReviewNodes,
  inspectGuestText,
  inspectGuestUrl,
  memberGuestBlock,
  normalizeGuestBody,
} from '../shared/guest'
import { LEGAL_LINKS } from '../shared/links'
import { schemaProblems } from '../shared/seo'
import { renderPage } from './helpers/render-page'

const root = resolve(process.cwd(), 'apps/web-app')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('guest byline and text', () => {
  it('uses the first name and the initial of the surname', () => {
    expect(guestByline('Анна Косарева')).toBe('Анна К.')
    expect(guestByline('Анна Ивановна Косарева')).toBe('Анна К.')
    expect(guestByline('Анна')).toBe('Анна')
    expect(normalizeGuestBody('  Уютно   было \n тут ')).toBe('уютно было тут')
  })

  it('refuses a second url, an email, a phone, and a banned host', () => {
    const ok = inspectGuestText(`${'Были во дворе форта и смотрели двор. '.repeat(4)} https://kremlin.ru/visit`)
    expect(ok.ok).toBe(true)
    expect(inspectGuestText('Напишите мне guest@example.com пожалуйста, это длинный отзыв о визите.').ok).toBe(false)
    const phone = inspectGuestText('Звоните +7 401 234-56-78 если нужен гид на длинную прогулку по форту.')
    expect(phone.ok).toBe(false)
    if (!phone.ok) {
      expect(phone.message).toBe('Уберите номер телефона из текста: «+7 401 234-56-78».')
    }
    expect(
      inspectGuestText('Смотрите https://kremlin.ru/a и https://kremlin.ru/b это длинный отзыв о визите в форт.').ok,
    ).toBe(false)
    expect(inspectGuestText('Смотрите http://kremlin.ru/a это длинный отзыв о визите во двор форта сегодня.').ok).toBe(
      false,
    )
    expect(inspectGuestUrl('https://user:pass@kremlin.ru/a').ok).toBe(false)
    expect(inspectGuestUrl('https://kgdmore.ru/post').ok).toBe(false)
    expect(inspectGuestUrl('https://localhost/a').ok).toBe(false)
    expect(inspectGuestText('Телефон +7 401 200-00-00', { allowPhone: true }).ok).toBe(true)
    expect(inspectGuestText('Были с 12.05.2025 - 14.05.2025 и двор был тихий.').ok).toBe(true)
    expect(inspectGuestText('Средний чек 10 000 - 15 000 руб, порции большие.').ok).toBe(true)
    for (const sample of ['+7 (401) 123-45-67', '8 401 123-45-67', '8 401 123 45 67', '84011234567', '+74011234567']) {
      const rejected = inspectGuestText(`Напишите ${sample} если нужна касса.`)
      expect(rejected.ok).toBe(false)
      if (!rejected.ok) {
        expect(rejected.message).toBe(`Уберите номер телефона из текста: «${sample}».`)
      }
    }
    expect(inspectGuestText('+7 (401) 123-45-67', { allowPhone: true }).ok).toBe(true)
  })

  it('checks a guest photo before it spends an hourly upload', () => {
    const source = read('server/utils/guests/photo.ts')
    const check = source.indexOf('uploadProblem(')
    const charge = source.indexOf('limitGuestPhoto(')
    expect(check).toBeGreaterThan(-1)
    expect(check).toBeLessThan(charge)
  })

  it('renders one hostname link and a Review without a rating', () => {
    const parts = guestParts('Смотрели двор. https://kremlin.ru/visit.')
    expect(parts.find((part) => part.type === 'link')).toMatchObject({
      text: 'kremlin.ru',
      href: 'https://kremlin.ru/visit',
    })
    const nodes = guestReviewNodes('https://k39.online/fort#place', [
      {
        kind: 'review',
        byline: 'Анна К.',
        body: 'Двор тихий, касса у ворот.',
        acceptedAt: '2026-10-16T12:00:00.000Z',
      },
    ])
    expect(nodes[0]).toMatchObject({
      '@type': 'Review',
      'author': { '@type': 'Person', 'name': 'Анна К.' },
      'inLanguage': 'ru',
      'itemReviewed': { '@id': 'https://k39.online/fort#place' },
    })
    expect(nodes[0]).not.toHaveProperty('reviewRating')
    expect(JSON.stringify(nodes[0])).not.toContain('Косарева')
    expect(schemaProblems(nodes)).toEqual([])
    expect(guestDay('2026-10-16T22:30:00.000Z')).toBe('2026-10-17')
    expect(guestDay('2026-10-16T12:00:00.000Z')).toBe('2026-10-16')
  })

  it('keeps a guest report below an hours change at the same traffic', () => {
    expect(priorityFor('prose', 'guest_report', 40)).toBeLessThan(priorityFor('hours', 'source_changed', 40))
    expect(memberGuestBlock('photo', null)).toContain('кабинет')
    expect(memberGuestBlock('correction', 'status')).toBe('')
    expect(memberGuestBlock('correction', 'price')).toContain('кабинет')
    expect(license.safeParse('guest').success).toBe(false)
  })

  it('limits text submits and photo uploads separately', () => {
    resetCabinetSlots()
    for (let index = 0; index < 5; index += 1) {
      limitGuestSubmit('guest-user', 5_000)
    }
    expect(() => limitGuestSubmit('guest-user', 5_000)).toThrow()
    resetCabinetSlots()
    for (let index = 0; index < 10; index += 1) {
      limitGuestPhoto('guest-user', 9_000)
    }
    expect(() => limitGuestPhoto('guest-user', 9_000)).toThrow()
  })
})

describe('guest pages', () => {
  it('renders the section and the form from fixture props', async () => {
    const html = await renderPage(GuestBlock, {
      subjectType: 'venue',
      subjectSlug: 'fixture-cafe-photo',
      subjectPath: '/zavedeniya/fixture-cafe-photo',
      items: [
        {
          id: 'fixture-note',
          kind: 'review',
          byline: 'Анна К.',
          acceptedAt: '2026-10-16T10:00:00.000Z',
          dateLabel: '16 октября 2026 г.',
          body: 'Фикстура: тихий зал и окно во двор.',
          parts: [{ type: 'text', text: 'Фикстура: тихий зал и окно во двор.' }],
          alt: '',
          media: null,
        },
      ],
    })
    expect(html).toContain('От гостей')
    expect(html).toContain('Анна К.')
    expect(html).toContain('Фикстура: тихий зал и окно во двор.')
    expect(html).toContain('Сообщение гостя')
    expect(html).toContain('Войти и отправить')
    expect(html).toContain(GUEST_CONSENT_PATH)
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('reviewRating')
  })

  it('renders the moderation queue with a disputed row', async () => {
    const html = await renderPage(GuestsAdmin, {})
    expect(html).toContain('Гостевые сообщения')
    expect(html).toContain('Спор')
    expect(html).toContain('Анна К.')
    expect(html).toContain('Фикстура: отзыв гостя для проверки очереди модерации.')
    expect(html).toContain('Принять')
    expect(html).toContain('Отклонить')
  })

  it('keeps the guest consent out of the footer and names the public byline', () => {
    expect(GUEST_CONSENT_VERSION).not.toBe('2026-10-12')
    expect(LEGAL_LINKS.map((link) => link.href)).not.toContain(GUEST_CONSENT_PATH)
    const privacy = read('app/pages/privacy.vue')
    const terms = read('app/pages/terms.vue')
    const consent = read('app/pages/gostevye-materialy.vue')
    const footer = read('app/components/SiteFooter.vue')
    expect(footer).not.toContain(GUEST_CONSENT_PATH)
    expect(privacy).toContain(`href="${GUEST_CONSENT_PATH}"`)
    expect(consent).toContain('имени и инициала фамилии')
    expect(consent).toContain('Полное имя учётной записи')
    expect(consent).toContain('Трансграничная передача данных не осуществляется')
    expect(consent).toContain('operatorIdLine()')
    expect(terms).toContain('неисключительную безвозмездную лицензию')
    expect(terms.replace(/\s+/g, ' ')).toContain('узнаваемого человека')
    expect(terms).toContain('не оплачивается')
    expect(terms).not.toContain('/soglasie')
  })
})
