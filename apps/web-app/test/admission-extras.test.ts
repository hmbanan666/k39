import { describe, expect, it } from 'vitest'
import TicketsFact from '../app/components/TicketsFact.vue'
import { admissionExtrasInput, admissionListInput, admissionPatchInput, normalizeAdmission } from '../server/utils/practical/admission'
import { ADMISSION_EXTRAS_UNKNOWN, ADMISSION_UNKNOWN, admissionFree, admissionOffers, admissionView } from '../shared/admission'
import { parseFactValue, valueHash } from '../shared/facts'
import { collectionDocument, placeDocument, venueDocument } from '../shared/seo'
import { admissionEntry, admissionExtra, admissionReviewNow as now } from './fixtures/admission-extras'
import { renderPage } from './helpers/render-page'

const entryInput = () => ({ slot: 'adult', audience: 'general' as const, priceRub: 500, sourceUrl: 'https://museum.example/prices', sourceTitle: 'Фикстура', checkedAt: '2026-10-20' })
const extraInput = () => ({ slot: 'audio', label: 'Фикстура: аудиогид', priceRub: 200, unit: 'device' as const, sourceUrl: 'https://museum.example/prices', sourceTitle: 'Фикстура', checkedAt: '2026-10-20' })

describe('admission extras contract', () => {
  it('has independent finite capacities and explicit list intent', () => {
    expect(admissionListInput.safeParse(Array.from({ length: 48 }, entryInput)).success).toBe(true)
    expect(admissionListInput.safeParse(Array.from({ length: 49 }, entryInput)).success).toBe(false)
    expect(admissionExtrasInput.safeParse(Array.from({ length: 12 }, extraInput)).success).toBe(true)
    expect(admissionExtrasInput.safeParse(Array.from({ length: 13 }, extraInput)).success).toBe(false)
    expect(admissionPatchInput.parse({ rows: [] })).toEqual({ rows: [] })
    expect(admissionPatchInput.parse({ extras: [] })).toEqual({ extras: [] })
    for (const input of [{}, { rows: null }, { extras: null }, { rows: [], surprise: true }]) {
      expect(admissionPatchInput.safeParse(input).success).toBe(false)
    }
  })

  it('refuses mixed shapes, unknown units, zero services and blank labels', () => {
    for (const patch of [{ audience: 'general' }, { unit: 'hour' }, { priceRub: 0 }, { priceRub: 1.5 }, { label: ' ' }, { label: 'а'.repeat(81) }, { condition: 'а'.repeat(201) }]) {
      expect(admissionExtrasInput.safeParse([{ ...extraInput(), ...patch }]).success).toBe(false)
    }
    expect(admissionListInput.safeParse([{ ...entryInput(), unit: 'person' }]).success).toBe(false)
    expect(admissionExtrasInput.parse([{ ...extraInput(), unit: null }])[0]!.unit).toBeNull()
    expect(() => normalizeAdmission([{ ...entryInput(), checkedAt: '2026-02-30' }], now)).toThrow('существующий день')
    expect(() => normalizeAdmission([{ ...entryInput(), checkedAt: '2026-10-24' }], now)).toThrow('не в будущем')
  })

  it('keeps legacy entry hashes and isolates extra fact shapes', () => {
    const old = { audience: 'general', priceRub: 500, condition: null, label: null }
    expect(parseFactValue('admission', old)).toEqual(old)
    expect(valueHash(parseFactValue('admission', old))).toBe(valueHash(old))
    expect(parseFactValue('admission', { ...old, kind: 'extra', unit: 'device' })).toBeNull()
    expect(parseFactValue('admission', { kind: 'extra', priceRub: 200, condition: null, label: 'Аудиогид', unit: null })).toMatchObject({ kind: 'extra', unit: null })
  })

  it('partitions same-name slots, sorts extras and excludes stale data independently', () => {
    const view = admissionView([admissionEntry(), admissionExtra({ slot: 'adult', sortOrder: 2 }), admissionExtra({ slot: 'tour', unit: 'group', sortOrder: 1 }), admissionExtra({ slot: 'old', checkedAt: '2025-01-01' })], now)
    expect(view.rows).toHaveLength(1)
    expect(view.extras.map((row) => row.slot)).toEqual(['tour', 'adult'])
    expect(view.extraLines.map((row) => row.unit)).toEqual(['за группу', 'за устройство'])
    expect(admissionOffers(view).map((offer) => offer.name)).toEqual(['Фикстура: основной билет'])
    expect(admissionFree(view)).toBe(false)
    const only = admissionView([admissionExtra()], now)
    expect(only.stored).toBe(false)
    expect(only.extrasStored).toBe(true)
    expect(admissionOffers(only)).toEqual([])
    expect(admissionFree(only)).toBeNull()
    expect(admissionFree(admissionView([admissionEntry({ audience: 'free', priceRub: 0 }), admissionExtra()], now))).toBe(true)
  })

  it('renders provenance, prerequisites, units and honest stale/entry fallbacks in SSR', async () => {
    const mixed = await renderPage(TicketsFact, { admission: admissionView([admissionEntry({ audience: 'free', priceRub: 0 }), admissionExtra({ unit: 'person', condition: 'Нужен входной билет' })], now) })
    for (const text of ['Билеты', 'Дополнительно', 'Нужен входной билет', 'за человека', 'https://museum.example/prices', 'datetime="2026-10-20"', 'Проверено']) {
      expect(mixed).toContain(text)
    }
    const only = admissionView([admissionExtra({ unit: null })], now)
    const missing = await renderPage(TicketsFact, { admission: only })
    expect(missing).toContain(ADMISSION_UNKNOWN)
    expect(missing).not.toContain('за человека')
    const legacy = await renderPage(TicketsFact, { admission: only, legacyPrice: 'Вход бесплатный' })
    expect(legacy).not.toContain(ADMISSION_UNKNOWN)
    const stale = await renderPage(TicketsFact, { admission: admissionView([admissionEntry({ checkedAt: '2025-01-01' }), admissionExtra({ checkedAt: '2025-01-01' })], now), legacyPrice: '300 ₽' })
    expect(stale).toContain(ADMISSION_UNKNOWN)
    expect(stale).toContain(ADMISSION_EXTRAS_UNKNOWN)
    expect(stale).not.toContain('300 ₽')
    expect(await renderPage(TicketsFact, { admission: admissionView([], now) })).not.toContain('Дополнительно')
  })

  it('never emits service offers on place, venue or route documents', () => {
    const admission = admissionView([admissionExtra()], now)
    const place = placeDocument({ slug: 'fixture-museum', title: 'Музей фикстуры', summary: 'Проверка.', categorySlug: 'muzei', categoryTitle: 'Музеи', regionTitle: 'Калининград', latitude: null, longitude: null, hours: null, sources: [], price: 'бесплатно', practical: { admission }, now })
    expect(place.jsonLd[1]).toMatchObject({ isAccessibleForFree: true })
    expect(place.jsonLd[1]).not.toHaveProperty('offers')
    const route = collectionDocument({ path: '/marshruty/fixture-route', h1: 'Маршрут фикстуры', summary: 'Проверка.', items: [], kind: 'TouristTrip', admission })
    expect(route.jsonLd[1]).not.toHaveProperty('offers')
    const venue = venueDocument({ slug: 'fixture-venue', name: 'Музей фикстуры', kind: 'cafe', description: 'Проверка.', address: null, latitude: null, longitude: null, phone: null, website: null, hours: null, practical: { admission } })
    expect(venue.jsonLd[1]).not.toHaveProperty('offers')
  })
})
