import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { normalizeObjectSchema, safeParse } from '@modelcontextprotocol/sdk/server/zod-compat.js'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ingestImage } from '../server/media/ingest'
import { saveHubContent, saveQuestContent } from '../server/utils/content/save'
import { commitFact } from '../server/utils/facts/commit'
import { setVenuePrices } from '../server/utils/facts/sync'
import { saveSchedule } from '../server/utils/schedule'
import { venuePricesWriteSchema } from '../server/utils/venues/prices'
import { venueCreateSchema } from '../server/utils/venues/schema'
import { venueModulesSchema } from '../shared/venue-modules'
import { bannedSiteProblem } from '../shared/writing'

describe('banned sites outside the prose gate', () => {
  it('rejects a banned site on a quest or hub save before the row is written', async () => {
    await expect(saveQuestContent({
      slug: 'banned-quest',
      title: 'Квест',
      body: 'Форт у дороги.',
      publicationStatus: 'draft',
      ogImage: 'https://kgdmore.ru/cover.jpg',
    }, null, { prose: ['Квест', 'Форт у дороги.'], publishing: false })).rejects.toThrow(/Нельзя использовать: kgdmore\.ru/)

    await expect(saveHubContent('hub-id', {
      title: 'Форты',
      description: 'Смотрите kgdmore.ru',
    }, { prose: ['Форты'], publishing: true })).rejects.toThrow(/kgdmore\.ru/)
  })

  it('rejects a banned source URL on a price, a fact, a schedule, and a photo', async () => {
    expect(bannedSiteProblem('https://example.com/menu')).toBeNull()
    await expect(setVenuePrices('venue', [{
      item: 'cappuccino',
      priceRub: 200,
      checkedAt: '2026-10-01',
      sourceKind: 'official',
      sourceTitle: 'Меню',
      sourceUrl: 'https://kgdmore.ru/menu',
    }], 'mcp')).rejects.toThrow(/kgdmore\.ru/)

    await expect(commitFact({
      kind: 'hours',
      subjectType: 'place',
      subjectId: 'place',
      slot: 'hours',
      value: { mode: 'closed' },
      sourceUrl: 'https://kgdmore.ru/hours',
      sourceTitle: null,
      sourceKind: 'official',
      checkedAt: null,
      confidence: 'stated',
      actor: 'mcp',
      refs: [],
    })).rejects.toThrow(/kgdmore\.ru/)

    await expect(saveSchedule('place', 'place', {
      rules: { mode: 'closed' } as never,
      sourceUrl: 'https://kgdmore.ru/hours',
      verifiedAt: null,
    })).rejects.toThrow(/kgdmore\.ru/)

    const photo = await ingestImage({
      bytes: Buffer.from('not-an-image'),
      mime: 'image/jpeg',
      filename: 'fort.jpg',
      alt: 'Форт',
      sourceUrl: 'https://kgdmore.ru/fort.jpg',
    })
    expect(photo).toMatchObject({ statusCode: 400, error: expect.stringMatching(/kgdmore\.ru/) })

    const toolDir = resolve(import.meta.dirname, '../server/mcp/tools')
    for (const file of ['media-upload-from-url.ts', 'commons-import.ts', 'fact-update.ts', 'schedule-set.ts', 'venue-prices-set.ts']) {
      expect(readFileSync(resolve(toolDir, file), 'utf8')).toMatch(/rejectBannedSites|banned site/)
    }
    expect(readFileSync(resolve(import.meta.dirname, '../server/api/admin/media/[id].patch.ts'), 'utf8')).toContain('rejectBannedSites')
  })
})

describe('prices in names', () => {
  it('rejects a price in a dish name or a price variant and lets a portion through', () => {
    const modules = venueModulesSchema.safeParse([{
      type: 'dishes',
      items: [{ name: 'Борщ 350 ₽' }],
    }])
    expect(modules.success).toBe(false)
    if (!modules.success) {
      expect(modules.error.issues.map((issue) => issue.message).join(' ')).toMatch(/Цену пишите/)
    }
    expect(venueModulesSchema.safeParse([{
      type: 'dishes',
      items: [{ name: 'Борщ' }],
    }]).success).toBe(true)

    const priceRow = {
      item: 'cappuccino',
      priceRub: 200,
      checkedAt: '2026-10-01',
      sourceKind: 'official' as const,
      sourceTitle: 'Меню',
      sourceUrl: 'https://cafe.example/menu',
    }
    for (const variant of ['350 руб', '350 rub', '350 rub.']) {
      const prices = venuePricesWriteSchema.safeParse([{ ...priceRow, variant }])
      expect(prices.success).toBe(false)
      if (!prices.success) {
        expect(prices.error.issues.map((issue) => issue.message).join(' ')).toMatch(/Цену пишите/)
      }
    }
    expect(venuePricesWriteSchema.safeParse([{ ...priceRow, variant: '250 мл' }]).success).toBe(true)
    const banned = venuePricesWriteSchema.safeParse([{ ...priceRow, sourceUrl: 'https://kgdmore.ru/menu' }])
    expect(banned.success).toBe(false)

    const listed = normalizeObjectSchema(z.object(venueCreateSchema))
    const named = safeParse(listed, {
      name: 'Кафе',
      kind: 'cafe',
      signatureDishes: [{ name: 'Обед 250 ₽' }],
    })
    expect(named.success).toBe(false)
    const clean = safeParse(listed, {
      name: 'Кафе',
      kind: 'cafe',
      signatureDishes: [{ name: 'Борщ' }],
    })
    expect(clean.success).toBe(true)
  })
})
