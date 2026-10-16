import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { useDatabase } from '../../database'
import { matchGuestFact, nextGuestProposal } from '../../guest-signal'
import { facts, guestSubmissions, venuePrices, verificationQueue } from '../../tables'
import { Editor } from '../content'
import { Facts } from '../facts'
import { Guests } from '../guests'
import { User } from '../user'

const HASH = 'b'.repeat(64)

describe('guest submissions', () => {
  const userIds: string[] = []

  afterEach(async () => {
    const db = useDatabase()
    if (userIds.length) {
      await db.delete(verificationQueue)
      await db.delete(facts)
      await db.delete(guestSubmissions)
    }
    userIds.length = 0
  })

  async function place() {
    return Editor.savePlace({
      slug: `guest-place-${Date.now()}`,
      title: 'Фикстура места',
      summary: '',
      body: 'Фикстура',
      publicationStatus: 'published',
    })
  }

  async function person(name: string) {
    const user = await User.create({ email: `${name}-${Date.now()}@example.com`, name })
    userIds.push(user.id)
    return user
  }

  it('keeps one pending review and refuses a duplicate body', async () => {
    const author = await person('Анна Косарева')
    const row = await place()
    const first = await Guests.create({
      userId: author.id,
      subjectType: 'place',
      subjectId: row.id,
      kind: 'review',
      body: 'Двор тихий',
      alt: null,
      correctionKind: null,
      correctionValue: null,
      sourceUrl: null,
      mediaId: null,
      bodyKey: 'двор тихий',
    })
    expect(first.ok).toBe(true)
    const again = await Guests.create({
      userId: author.id,
      subjectType: 'place',
      subjectId: row.id,
      kind: 'review',
      body: 'Другой текст',
      alt: null,
      correctionKind: null,
      correctionValue: null,
      sourceUrl: null,
      mediaId: null,
      bodyKey: 'другой текст',
    })
    expect(again).toMatchObject({ ok: false, reason: 'pending' })
    const other = await person('Борис')
    const duplicate = await Guests.create({
      userId: other.id,
      subjectType: 'place',
      subjectId: row.id,
      kind: 'review',
      body: 'Двор тихий',
      alt: null,
      correctionKind: null,
      correctionValue: null,
      sourceUrl: null,
      mediaId: null,
      bodyKey: 'двор тихий',
    })
    expect(duplicate).toMatchObject({ ok: false, reason: 'duplicate' })
  })

  it('queues a price report without writing the price', async () => {
    const author = await person('Анна Косарева')
    const editor = await person('Редактор')
    const row = await place()
    const written = await Facts.upsert({
      kind: 'price',
      subjectType: 'place',
      subjectId: row.id,
      slot: 'price:cappuccino:300',
      value: { itemId: 'cappuccino', itemSlug: 'cappuccino', variant: '300', priceRub: 200 },
      valueHash: HASH,
      sourceUrl: 'https://fixture.k39.test/menu',
      sourceTitle: 'Меню',
      sourceKind: 'official',
      checkedAt: '2026-10-01T00:00:00.000Z',
      ttlDays: 90,
      confidence: 'stated',
      actor: 'editor',
    }, [])
    const created = await Guests.create({
      userId: author.id,
      subjectType: 'place',
      subjectId: row.id,
      kind: 'correction',
      body: 'На меню другая цифра',
      alt: null,
      correctionKind: 'price',
      correctionValue: 'капучино 250',
      sourceUrl: 'https://example.com/note',
      mediaId: null,
      bodyKey: null,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) {
      return
    }
    await Guests.decide(created.id, editor.id, 'accepted', null)
    const signal = await Guests.signalCorrection({
      submissionId: created.id,
      subjectType: 'place',
      subjectId: row.id,
      correctionKind: 'price',
      value: 'капучино cappuccino 250',
      note: 'На меню другая цифра',
      url: 'https://example.com/note',
      priority: 1,
    })
    expect(signal.reason).toBe('guest_report')
    expect(signal.factId).toBe(written.fact.id)
    expect(signal.proposal).toMatchObject({ count: 1, submissionId: created.id })
    const again = await Guests.signalCorrection({
      submissionId: created.id,
      subjectType: 'place',
      subjectId: row.id,
      correctionKind: 'price',
      value: 'cappuccino 260',
      note: '',
      url: null,
      priority: 1,
    })
    expect(again.id).toBe(signal.id)
    expect(again.proposal).toMatchObject({ count: 2, text: 'cappuccino 260' })
    const stored = await Facts.byId(written.fact.id)
    expect(stored?.value).toMatchObject({ priceRub: 200 })
    const prices = await useDatabase().select().from(venuePrices).where(eq(venuePrices.venueId, row.id))
    expect(prices).toEqual([])
    const open = await useDatabase().select().from(verificationQueue).where(eq(verificationQueue.reason, 'guest_report'))
    expect(open.filter((item) => !item.resolvedAt)).toHaveLength(1)
  })

  it('uses a section path when no fact matches and closes it when the fact is written', async () => {
    const row = await place()
    expect(matchGuestFact('phone', '12', [])).toBeNull()
    expect(nextGuestProposal(null, { submissionId: 's', text: 'a', url: null }).count).toBe(1)
    const signal = await Guests.signalCorrection({
      submissionId: 'pending-id',
      subjectType: 'place',
      subjectId: row.id,
      correctionKind: 'phone',
      value: 'новый номер',
      note: '',
      url: null,
      priority: 1,
    })
    expect(signal.target).toBe('section')
    expect(signal.path).toBe('guest:phone')
    await Facts.upsert({
      kind: 'phone',
      subjectType: 'place',
      subjectId: row.id,
      slot: 'phone',
      value: { text: '+7 401 000' },
      valueHash: HASH,
      sourceUrl: null,
      sourceTitle: null,
      sourceKind: 'official',
      checkedAt: '2026-10-16T00:00:00.000Z',
      ttlDays: 180,
      confidence: 'stated',
      actor: 'editor',
    }, [])
    const [closed] = await useDatabase().select().from(verificationQueue).where(eq(verificationQueue.id, signal.id))
    expect(closed?.resolvedAt).toBeTruthy()
  })

  it('clears the body when the author removes the row', async () => {
    const author = await person('Анна Косарева')
    const row = await place()
    const created = await Guests.create({
      userId: author.id,
      subjectType: 'place',
      subjectId: row.id,
      kind: 'tip',
      body: 'Берите сдачу у кассы у входа',
      alt: null,
      correctionKind: null,
      correctionValue: null,
      sourceUrl: null,
      mediaId: null,
      bodyKey: 'берите сдачу у кассы у входа',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) {
      return
    }
    await Guests.decide(created.id, author.id, 'accepted', null)
    const blocked = await Guests.create({
      userId: author.id,
      subjectType: 'place',
      subjectId: row.id,
      kind: 'tip',
      body: 'Другой совет про кассу и сдачу',
      alt: null,
      correctionKind: null,
      correctionValue: null,
      sourceUrl: null,
      mediaId: null,
      bodyKey: 'другой совет про кассу и сдачу',
    })
    expect(blocked).toMatchObject({ ok: false, reason: 'cap' })
    await Guests.removeOwn(created.id, author.id)
    const stored = await Guests.byId(created.id)
    expect(stored?.status).toBe('removed')
    expect(stored?.body).toBeNull()
    const published = await Guests.published('place', row.id)
    expect(published).toEqual([])
  })

  it('records an editor decision and a token decision on the same columns', async () => {
    const author = await person('Анна Косарева')
    const editor = await person('Редактор')
    const row = await place()
    const accepted = await Guests.create({
      userId: author.id,
      subjectType: 'place',
      subjectId: row.id,
      kind: 'tip',
      body: 'Касса у входа справа',
      alt: null,
      correctionKind: null,
      correctionValue: null,
      sourceUrl: null,
      mediaId: null,
      bodyKey: 'касса у входа справа',
    })
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) {
      return
    }
    const byEditor = await Guests.decide(accepted.id, editor.id, 'accepted', null)
    expect(byEditor?.status).toBe('accepted')
    expect(byEditor?.decidedBy).toBe(editor.id)

    const other = await person('Борис')
    const pending = await Guests.create({
      userId: other.id,
      subjectType: 'place',
      subjectId: row.id,
      kind: 'review',
      body: 'Фикстура отзыва для токена',
      alt: null,
      correctionKind: null,
      correctionValue: null,
      sourceUrl: null,
      mediaId: null,
      bodyKey: 'фикстура отзыва для токена',
    })
    expect(pending.ok).toBe(true)
    if (!pending.ok) {
      return
    }
    const byToken = await Guests.decide(pending.id, null, 'rejected', 'На фото узнаваемый человек. Такие снимки не публикуем.')
    expect(byToken?.status).toBe('rejected')
    expect(byToken?.decidedBy).toBeNull()
    expect(byToken?.decisionNote).toBe('На фото узнаваемый человек. Такие снимки не публикуем.')
    const flagged = await Guests.create({
      userId: other.id,
      subjectType: 'place',
      subjectId: row.id,
      kind: 'tip',
      body: 'Неясно, спам или визит у кассы',
      alt: null,
      correctionKind: null,
      correctionValue: null,
      sourceUrl: null,
      mediaId: null,
      bodyKey: 'неясно спам или визит у кассы',
    })
    expect(flagged.ok).toBe(true)
    if (!flagged.ok) {
      return
    }
    const dispute = await Guests.flagDispute(flagged.id, null)
    expect(dispute?.status).toBe('pending')
    expect(dispute?.disputed).toBe(true)
  })

  it('flags a dispute without accepting the row', async () => {
    const author = await person('Анна')
    const editor = await person('Редактор')
    const row = await place()
    const created = await Guests.create({
      userId: author.id,
      subjectType: 'place',
      subjectId: row.id,
      kind: 'review',
      body: 'Неясно, спам это или визит',
      alt: null,
      correctionKind: null,
      correctionValue: null,
      sourceUrl: null,
      mediaId: null,
      bodyKey: 'неясно спам',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) {
      return
    }
    const flagged = await Guests.flagDispute(created.id, editor.id)
    expect(flagged?.status).toBe('pending')
    expect(flagged?.disputed).toBe(true)
    const rejected = await Guests.decide(created.id, editor.id, 'rejected', 'Похоже на рекламу')
    expect(rejected?.status).toBe('rejected')
    expect(rejected?.decisionNote).toBe('Похоже на рекламу')
    expect(rejected?.disputed).toBe(false)
  })
})
