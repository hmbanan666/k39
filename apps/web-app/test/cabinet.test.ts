import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { claimCodesMatch, hashClaimCode } from '@k39/database'
import { describe, expect, it } from 'vitest'
import { postClaimCode } from '../server/utils/cabinet/deliver'
import { limitClaimStart, resetCabinetSlots } from '../server/utils/cabinet/rate'
import { asOwnerPrices, venuePricesWriteSchema } from '../server/utils/venues/prices'
import { claimChannelPlan, maskEmail, maskPhone, ownerVenueSchema, pickOwnerFields, safeInternalPath, venueClaimPath } from '../shared/cabinet'

describe('cabinet claim helpers', () => {
  it('masks a mailbox and a phone and hides a short number', () => {
    expect(maskEmail('desk@cafe.test')).toBe('d***@cafe.test')
    expect(maskEmail('not-an-email')).toBeNull()
    expect(maskPhone('+7 (4012) 34-56-78')).toBe('***78')
    expect(maskPhone('123')).toBeNull()
  })

  it('offers a code only when the venue already has the address and transport is on', () => {
    const ready = claimChannelPlan({
      phone: '+7 4012 00-00-00',
      contactEmail: 'a@cafe.test',
      emailTransport: true,
      phoneTransport: false,
    })
    expect(ready.email.present).toBe(true)
    expect(ready.email.transport).toBe(true)
    expect(ready.email.mask).toBe('a***@cafe.test')
    expect(ready.phone.present).toBe(true)
    expect(ready.phone.transport).toBe(false)
    const empty = claimChannelPlan({ phone: null, contactEmail: null, emailTransport: true, phoneTransport: true })
    expect(empty.email.present).toBe(false)
    expect(empty.phone.present).toBe(false)
  })

  it('drops editorial fields before an owner save', () => {
    expect(pickOwnerFields({
      status: 'archived',
      slug: 'hijack',
      contactEmail: 'thief@example.com',
      seoTitle: 'куплю',
      phone: '+7 900 000-00-00',
      modules: [{ type: 'prices' }],
    })).toEqual({
      phone: '+7 900 000-00-00',
      modules: [{ type: 'prices' }],
    })
    expect(ownerVenueSchema.safeParse({ status: 'draft' }).success).toBe(false)
    const parsed = ownerVenueSchema.safeParse(pickOwnerFields({ phone: '  +7 900  ', description: 'Текст' }))
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.phone).toBe('+7 900')
    }
    const modules = ownerVenueSchema.safeParse({
      modules: [{ type: 'text', variant: 'plain', text: 'Своими словами.' }, { type: 'prices' }],
    })
    expect(modules.success).toBe(true)
    expect(ownerVenueSchema.safeParse({
      modules: [{ type: 'prices' }, { type: 'prices' }],
    }).success).toBe(false)
    const price = venuePricesWriteSchema.safeParse([{
      item: 'cappuccino',
      priceRub: 180,
      checkedAt: '2026-10-15',
      sourceKind: 'owner',
      sourceTitle: 'Сообщено заведением',
      sourceUrl: null,
    }])
    expect(price.success).toBe(true)
    if (price.success) {
      expect(asOwnerPrices([{ ...price.data[0]!, sourceKind: 'official', sourceUrl: 'https://aggregator.example/menu' }])).toEqual([{
        item: 'cappuccino',
        variant: undefined,
        priceRub: 180,
        checkedAt: '2026-10-15',
        sourceKind: 'owner',
        sourceTitle: 'Сообщено заведением',
        sourceUrl: null,
      }])
    }
  })

  it('keeps the claim link on the site and refuses an external return path', () => {
    expect(venueClaimPath('кофе')).toBe('/kabinet/zayavka/%D0%BA%D0%BE%D1%84%D0%B5')
    expect(safeInternalPath('/kabinet')).toBe('/kabinet')
    expect(safeInternalPath('//evil.example')).toBe('/')
    expect(safeInternalPath('https://evil.example')).toBe('/')
    expect(safeInternalPath('/kabinet', '')).toBe('/kabinet')
    const page = readFileSync(resolve(__dirname, '../app/components/VenuePage.vue'), 'utf8')
    expect(page).toContain('venueClaimPath(venue.slug)')
    expect(page).toContain('Это моё заведение')
    expect(page).not.toContain('напишите нам')
    const robots = readFileSync(resolve(__dirname, '../public/robots.txt'), 'utf8')
    expect(robots).toContain('Disallow: /kabinet')
  })

  it('matches a claim code without accepting a different one', () => {
    const hash = hashClaimCode({ pepper: 'pepper-pepper-pepper-pepper-pepper', venueId: 'v', userId: 'u', code: '123456' })
    expect(claimCodesMatch(hash, hashClaimCode({ pepper: 'pepper-pepper-pepper-pepper-pepper', venueId: 'v', userId: 'u', code: '123456' }))).toBe(true)
    expect(claimCodesMatch(hash, hashClaimCode({ pepper: 'pepper-pepper-pepper-pepper-pepper', venueId: 'v', userId: 'u', code: '000000' }))).toBe(false)
    expect(hash).not.toContain('123456')
  })

  it('stops a sixth claim start inside the hour', () => {
    resetCabinetSlots()
    for (let index = 0; index < 5; index += 1) {
      expect(limitClaimStart('user-1', 1_000 + index)).toBe(index + 1)
    }
    expect(() => limitClaimStart('user-1', 1_500)).toThrowError(expect.objectContaining({ statusCode: 429 }))
    expect(limitClaimStart('user-2', 1_500)).toBe(1)
  })

  it('posts a code only to https and never returns it', async () => {
    const seen: unknown[] = []
    await postClaimCode({
      url: 'https://mail.example/send',
      token: 'secret-token',
      body: { channel: 'email', to: 'desk@cafe.test', code: '445566', venue: 'Маяк' },
      fetchImpl: async (url, init) => {
        seen.push({ url: String(url), body: init?.body, authorization: (init?.headers as Record<string, string>).authorization })
        return new Response('ok', { status: 204 })
      },
    })
    expect(seen).toEqual([{
      url: 'https://mail.example/send',
      body: JSON.stringify({ channel: 'email', to: 'desk@cafe.test', code: '445566', venue: 'Маяк' }),
      authorization: 'Bearer secret-token',
    }])
    await expect(postClaimCode({
      url: 'http://mail.example/send',
      body: { channel: 'email', to: 'a@b.c', code: '1', venue: 'X' },
      fetchImpl: async () => new Response('no'),
    })).rejects.toThrow(/delivery_url/)
  })
})
