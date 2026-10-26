import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { CLAIM_MAX_ATTEMPTS, hashClaimCode } from '../../claims'
import { useDatabase } from '../../database'
import { users, venueAudits, venueClaims, venueMembers, venues } from '../../tables'
import { VenueInputError } from '../../venues'
import { VenueClaims } from '../claims'
import { Prices } from '../prices'
import { User } from '../user'
import { Venues } from '../venues'

const PEPPER = 'test-pepper-test-pepper-test-pepper'

function description() {
  return 'Кафе у форта Дёнхофф варит кофе и кормит обедом. '.repeat(8).slice(0, 420)
}

async function wipe() {
  const db = useDatabase()
  await db.delete(venueAudits)
  await db.delete(venueClaims)
  await db.delete(venueMembers)
  await db.delete(venues)
  await db.delete(users)
}

async function person(email: string) {
  return User.create({ email, name: email.split('@')[0] || 'Гость' })
}

async function cafe(name = 'Кофейня у форта') {
  return Venues.create({
    name,
    kind: 'coffee',
    description: description(),
    status: 'published',
    phone: '+7 4012 34-56-78',
    contactEmail: 'desk@cafe.test',
    modules: [{ type: 'text', variant: 'plain', text: 'Кафе варит кофе и кормит обедом.' }],
  })
}

describe('venue claims', () => {
  beforeEach(async () => {
    await wipe()
  })

  it('grants the owner only after the code matches and locks a repeated miss', async () => {
    const owner = await person('owner@example.com')
    const other = await person('other@example.com')
    const venue = await cafe()
    const code = '482193'
    const opened = await VenueClaims.createPending({
      venueId: venue.id,
      userId: owner.id,
      channel: 'email',
      destination: 'desk@cafe.test',
      evidence: null,
      codeHash: hashClaimCode({ pepper: PEPPER, venueId: venue.id, userId: owner.id, code }),
      codeExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(opened.created).toBe(true)

    const stolen = await VenueClaims.consumeCode({
      claimId: opened.claim.id,
      userId: other.id,
      code,
      pepper: PEPPER,
    })
    expect(stolen).toEqual({ ok: false, reason: 'missing' })
    expect(await VenueClaims.owner(venue.id)).toBeUndefined()

    const wrong = await VenueClaims.consumeCode({
      claimId: opened.claim.id,
      userId: owner.id,
      code: '000000',
      pepper: PEPPER,
    })
    expect(wrong).toEqual({ ok: false, reason: 'mismatch' })
    expect(await VenueClaims.member(venue.id, owner.id)).toBeUndefined()

    const again = await VenueClaims.pending(venue.id, owner.id)
    expect(again?.attempts).toBe(1)

    for (let attempt = 2; attempt < CLAIM_MAX_ATTEMPTS; attempt += 1) {
      await VenueClaims.consumeCode({ claimId: opened.claim.id, userId: owner.id, code: '000000', pepper: PEPPER })
    }
    const locked = await VenueClaims.consumeCode({
      claimId: opened.claim.id,
      userId: owner.id,
      code: '000000',
      pepper: PEPPER,
    })
    expect(locked.ok).toBe(false)
    if (!locked.ok) {
      expect(locked.reason).toBe('locked')
    }
    expect(await VenueClaims.owner(venue.id)).toBeUndefined()

    const fresh = '120045'
    await VenueClaims.setCode(
      opened.claim.id,
      owner.id,
      hashClaimCode({ pepper: PEPPER, venueId: venue.id, userId: owner.id, code: fresh }),
      new Date(Date.now() + 60_000).toISOString(),
    )
    const ok = await VenueClaims.consumeCode({
      claimId: opened.claim.id,
      userId: owner.id,
      code: fresh,
      pepper: PEPPER,
    })
    expect(ok).toEqual({ ok: true, venueId: venue.id })
    expect((await VenueClaims.member(venue.id, owner.id))?.role).toBe('owner')
    expect((await VenueClaims.byId(opened.claim.id))?.codeHash).toBeNull()
  })

  it('rejects a second owner and an expired code', async () => {
    const first = await person('first@example.com')
    const second = await person('second@example.com')
    const venue = await cafe()
    await VenueClaims.addMember(venue.id, first.id, 'owner')
    await expect(VenueClaims.addMember(venue.id, second.id, 'owner')).rejects.toBeInstanceOf(VenueInputError)
    const editor = await VenueClaims.addMember(venue.id, second.id, 'editor')
    expect(editor.role).toBe('editor')

    const code = '111111'
    const claim = await VenueClaims.createPending({
      venueId: venue.id,
      userId: second.id,
      channel: 'phone',
      destination: '+74012345678',
      evidence: null,
      codeHash: hashClaimCode({ pepper: PEPPER, venueId: venue.id, userId: second.id, code }),
      codeExpiresAt: new Date(Date.now() - 1000).toISOString(),
    })
    const expired = await VenueClaims.consumeCode({
      claimId: claim.claim.id,
      userId: second.id,
      code,
      pepper: PEPPER,
    })
    expect(expired).toEqual({ ok: false, reason: 'expired' })
    const taken = await VenueClaims.decide({ claimId: claim.claim.id, adminId: first.id, decision: 'approve' })
    expect(taken).toEqual({ ok: false, reason: 'taken' })
    expect((await VenueClaims.owner(venue.id))?.userId).toBe(first.id)
  })

  it('lets an editor approve a manual claim and keeps the rival out', async () => {
    const claimant = await person('claim@example.com')
    const rival = await person('rival@example.com')
    const editor = await person('desk@k39.online')
    const venue = await cafe('Пекарня на променаде')
    const manual = await VenueClaims.createPending({
      venueId: venue.id,
      userId: claimant.id,
      channel: 'manual',
      destination: null,
      evidence: 'Я пеку здесь с 2014 года, сайт pekarnya.example.',
      codeHash: null,
      codeExpiresAt: null,
    })
    const other = await VenueClaims.createPending({
      venueId: venue.id,
      userId: rival.id,
      channel: 'manual',
      destination: null,
      evidence: 'Тоже я, честно.',
      codeHash: null,
      codeExpiresAt: null,
    })
    const rejected = await VenueClaims.decide({ claimId: other.claim.id, adminId: editor.id, decision: 'reject' })
    expect(rejected.ok).toBe(true)
    expect(await VenueClaims.owner(venue.id)).toBeUndefined()

    const approved = await VenueClaims.decide({ claimId: manual.claim.id, adminId: editor.id, decision: 'approve' })
    expect(approved).toMatchObject({ ok: true, decision: 'approve' })
    expect((await VenueClaims.member(venue.id, claimant.id))?.role).toBe('owner')
    const pending = await useDatabase().select().from(venueClaims).where(eq(venueClaims.userId, rival.id))
    expect(pending[0]?.status).toBe('rejected')
    const log = await VenueClaims.audits(venue.id)
    expect(log.map((row) => row.action)).toContain('claim_verified')
    expect(JSON.stringify(log)).not.toContain('482193')
  })

  it('saves an owner edit, refuses to treat status as part of that write, and reverts', async () => {
    const owner = await person('baker@example.com')
    const venue = await cafe('Булочная')
    await VenueClaims.addMember(venue.id, owner.id, 'owner')
    const before = await Venues.byId(venue.id)
    const saved = await Venues.update(
      venue.id,
      {
        phone: '+7 900 000-00-11',
        modules: [
          { type: 'prices' },
          { type: 'text', variant: 'plain', text: 'Новый текст о булочной, своими словами.' },
        ],
        description: description(),
      },
      owner.id,
    )
    expect(saved?.phone).toBe('+7 900 000-00-11')
    expect(saved?.status).toBe('published')
    expect(saved?.modules).toEqual([
      { type: 'prices' },
      { type: 'text', variant: 'plain', text: 'Новый текст о булочной, своими словами.' },
    ])
    expect(saved?.contactEmail).toBe('desk@cafe.test')
    const priced = await Prices.setForVenue(venue.id, [
      {
        item: 'cappuccino',
        priceRub: 180,
        checkedAt: '2026-10-15',
        sourceKind: 'owner',
        sourceTitle: 'Сообщено заведением',
      },
    ])
    expect(priced[0]?.item).toBe('cappuccino')
    expect(priced[0]?.sourceKind).toBe('owner')
    await expect(
      Prices.setForVenue(venue.id, [
        {
          item: 'no-such-item',
          priceRub: 10,
          checkedAt: '2026-10-15',
          sourceKind: 'owner',
          sourceTitle: 'Сообщено заведением',
        },
      ]),
    ).rejects.toThrow(/каталог/)

    const history = await Venues.revisions(venue.id)
    expect(history.length).toBeGreaterThan(0)
    const restored = await Venues.revertTo(venue.id, history[0]!.id, owner.id)
    expect(restored?.phone).toBe(before?.phone)
    expect(restored?.modules).toEqual([{ type: 'text', variant: 'plain', text: 'Кафе варит кофе и кормит обедом.' }])
    const again = await Venues.revisions(venue.id)
    expect(again.length).toBeGreaterThan(history.length)
  })

  it('searches published names and skips drafts and wildcard noise', async () => {
    await cafe('Кофейня Маяк')
    await Venues.create({ name: 'Черновик Маяк', kind: 'cafe', description: '', status: 'draft' })
    expect((await Venues.searchPublic('%')).map((row) => row.name)).toEqual([])
    expect((await Venues.searchPublic('маяк')).map((row) => row.name)).toEqual(['Кофейня Маяк'])
    const row = (await Venues.searchPublic('маяк'))[0]
    expect(row).not.toHaveProperty('phone')
    expect(row).not.toHaveProperty('contactEmail')
  })
})
