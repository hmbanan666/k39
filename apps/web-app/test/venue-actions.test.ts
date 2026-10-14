import { describe, expect, it } from 'vitest'
import { telHref, venueActions, venueServiceNotes } from '../shared/venue-actions'

describe('venue actions', () => {
  it('makes booking primary, then order, delivery and phone', () => {
    const all = venueActions({ bookingUrl: 'https://a/b', orderUrl: 'https://a/o', phone: '+7 900 569-09-94', website: 'https://a/' })
    expect(all.primary?.key).toBe('booking')
    expect(all.secondary.map((item) => item.key)).toEqual(['order', 'phone', 'website'])
    expect(venueActions({ phone: '+7 4012 30-71-50' }).primary).toEqual({ key: 'phone', label: 'Позвонить', href: 'tel:+74012307150', external: false })
    expect(venueActions({ deliveryUrl: 'https://d' }).primary?.key).toBe('delivery')
  })

  it('never invents an action', () => {
    expect(venueActions({})).toEqual({ primary: null, secondary: [] })
    const menuOnly = venueActions({ menuUrl: 'https://m', website: 'https://w' })
    expect(menuOnly.primary).toBeNull()
    expect(menuOnly.secondary.map((item) => item.key)).toEqual(['menu', 'website'])
    expect(telHref('нет')).toBe('')
  })

  it('lists only known service facts', () => {
    expect(venueServiceNotes({ reservation: 'recommended', takeaway: true, delivery: null })).toEqual(['Лучше бронировать', 'Еда навынос'])
    expect(venueServiceNotes({})).toEqual([])
  })
})
