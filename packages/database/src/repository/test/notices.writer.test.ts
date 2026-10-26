// Lives in the database suite so it uses that Postgres.
// The .writer.test.ts suffix is the typecheck rule: this package's tsc
// excludes it, and scripts/typecheck-writer.mjs includes every match.
import type { NoticeInput } from '../../../../../apps/web-app/shared/notices'
import { and, eq, inArray } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { enterContentScope } from '../../../../../apps/web-app/server/utils/access'
import { adminPlaceDraftView } from '../../../../../apps/web-app/server/utils/admin/place-draft'
import { updatePlaceDraft } from '../../../../../apps/web-app/server/utils/mcp/places'
import { setPublication } from '../../../../../apps/web-app/server/utils/mcp/publish'
import { adminNoticesView, decideVenueNoticeDraft } from '../../../../../apps/web-app/server/utils/notices/admin'
import { loadPublicNotices, sourcesWithNotices } from '../../../../../apps/web-app/server/utils/notices/read'
import { noticesView, setNotices } from '../../../../../apps/web-app/server/utils/notices/write'
import { practicalTarget } from '../../../../../apps/web-app/server/utils/practical/target'
import { updateVenue } from '../../../../../apps/web-app/server/utils/venues/write'
import { liveStatusText, noticeToday, withNoticeStatus } from '../../../../../apps/web-app/shared/notices'
import { useDatabase } from '../../database'
import { contentDrafts, mcpAudits, notices, places, revisions, venueAudits, venues } from '../../tables'
import { Editor } from '../content'
import { Notices } from '../notices'
import { Schedules } from '../schedules'
import { Venues } from '../venues'

const placeIds: string[] = []
const venueIds: string[] = []

afterEach(async () => {
  enterContentScope('editor')
  const database = useDatabase()
  const all = [...placeIds, ...venueIds]
  if (all.length) {
    await database.delete(notices).where(inArray(notices.subjectId, all))
    await database.delete(contentDrafts).where(inArray(contentDrafts.entityId, all))
    await database.delete(mcpAudits).where(inArray(mcpAudits.entityId, all))
    await database.delete(revisions).where(inArray(revisions.entityId, all))
  }
  for (const id of placeIds) {
    await database.delete(places).where(eq(places.id, id))
  }
  for (const id of venueIds) {
    await Schedules.remove('venue', id)
    await database.delete(venues).where(eq(venues.id, id))
  }
  placeIds.length = 0
  venueIds.length = 0
})

const SITE = 'https://museum-notice.example.ru/news/1'
const VK_POST = 'https://vk.com/wall-123456_789'

async function place(slug: string, publicationStatus: 'draft' | 'published' | 'archived' = 'published') {
  const row = await Editor.savePlace({
    slug,
    title: 'Музей у реки',
    summary: 'Музей в старом доме у реки.',
    body: 'Текст страницы о музее.',
    publicationStatus,
    noindex: true,
  })
  placeIds.push(row.id)
  return row
}

async function venue(slug: string, status: 'draft' | 'published' | 'closed' | 'archived' = 'published') {
  const row = await Venues.create({
    slug,
    name: 'Кафе у вокзала',
    kind: 'cafe',
    status,
    description: 'Кафе у вокзала для проверки объявлений. '.repeat(9),
    address: 'ул. Вокзальная, 1',
    latitude: 54.7,
    longitude: 20.5,
    socials: [{ network: 'vk', url: 'https://vk.com/club123456' }],
  })
  venueIds.push(row.id)
  return row
}

function row(over: Partial<NoticeInput> = {}): NoticeInput {
  const today = noticeToday(new Date())
  return {
    kind: 'closed',
    from: today,
    to: shift(today, 5),
    text: 'Музей закрыт для посетителей.',
    sourceUrl: SITE,
    sourceTitle: 'Новости музея',
    checkedAt: today,
    ...over,
  }
}

function shift(day: string, days: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

async function rejects(promise: Promise<unknown>, status: number, message?: RegExp) {
  const error = await promise.then(
    () => null,
    (caught: { statusCode?: number; statusMessage?: string }) => caught,
  )
  expect(error, 'expected a rejection').not.toBeNull()
  expect(error?.statusCode).toBe(status)
  if (message) {
    expect(error?.statusMessage).toMatch(message)
  }
}

function stagedText(draft: { payload: Record<string, unknown> } | null) {
  const list = draft?.payload.notices as Array<{ text: string }> | undefined
  return list?.[0]?.text
}

describe('notices writer', () => {
  it.each(
    (['place', 'venue'] as const).flatMap((subjectType) => [false, true].map((mixed) => ({ subjectType, mixed }))),
  )(
    'retains notice advisories through authorized pending publication ($subjectType, mixed=$mixed)',
    async ({ subjectType, mixed }) => {
      const live = subjectType === 'place' ? await place('notice-advisory-apply') : await venue('notice-advisory-apply')
      enterContentScope('draft')
      if (mixed) {
        if (subjectType === 'place') {
          await updatePlaceDraft({ id: live.id, summary: 'Дом у самой площади.' }, 'place_update')
        } else {
          await updateVenue({
            id: live.id,
            description: `${'description' in live ? live.description : ''} Дом у самой площади.`,
          })
        }
      }
      const sourceUrl = subjectType === 'venue' ? VK_POST : SITE
      await setNotices(
        {
          subjectType,
          id: live.id,
          notices: [
            row({
              kind: 'renovation',
              text: 'Ремонт в самом сердце здания.',
              sourceUrl,
            }),
          ],
        },
        'mcp',
      )
      const database = useDatabase()
      const state = async () => ({
        live: subjectType === 'place' ? await Editor.placeById(live.id) : await Venues.byId(live.id),
        pending: await Editor.contentDraft(subjectType, live.id),
        notices: await Notices.forSubject(subjectType, live.id),
        audits: await database.select().from(mcpAudits).where(eq(mcpAudits.entityId, live.id)),
        revisions: await database.select().from(revisions).where(eq(revisions.entityId, live.id)),
        venueAudits:
          subjectType === 'venue'
            ? await database.select().from(venueAudits).where(eq(venueAudits.venueId, live.id))
            : [],
      })
      const beforeRefusal = await state()
      enterContentScope('editor')
      await rejects(
        setPublication({ entity: subjectType, id: live.id, publicationStatus: 'published' }),
        400,
        /в самом сердце/u,
      )
      expect(await state()).toEqual(beforeRefusal)
      enterContentScope('draft')
      const staged = await setNotices(
        {
          subjectType,
          id: live.id,
          notices: [
            row({
              kind: 'renovation',
              text: 'Ремонт у самого входа.',
              sourceUrl,
            }),
          ],
        },
        'mcp',
      )
      expect(staged.writingWarnings).toHaveLength(1)
      const warning = staged.writingWarnings[0]!
      expect(warning).toMatch(/Неопределённость.*«самого».*0 баллов/u)
      const pending = await Editor.contentDraft(subjectType, live.id)
      expect(await Notices.forSubject(subjectType, live.id)).toEqual([])
      await rejects(setPublication({ entity: subjectType, id: live.id, publicationStatus: 'published' }), 403)
      expect(await Editor.contentDraft(subjectType, live.id)).toEqual(pending)
      enterContentScope('editor')
      const applied = await setPublication({ entity: subjectType, id: live.id, publicationStatus: 'published' })
      expect(applied).toMatchObject({
        writingWarnings: mixed ? expect.arrayContaining([warning, expect.stringContaining('«самой»')]) : [warning],
      })
      expect((await Notices.forSubject(subjectType, live.id))[0]?.text).toBe('Ремонт у самого входа.')
      expect(await Editor.contentDraft(subjectType, live.id)).toBeNull()
      const saved = subjectType === 'place' ? await Editor.placeById(live.id) : await Venues.byId(live.id)
      expect(saved).toMatchObject(
        mixed
          ? subjectType === 'place'
            ? { summary: 'Дом у самой площади.' }
            : { description: expect.stringContaining('Дом у самой площади.') }
          : live,
      )
    },
  )

  it('validates kinds, dates, the open end, text, and the source', async () => {
    const live = await place('notice-validate')
    enterContentScope('editor')
    const set = (rows: NoticeInput[]) => setNotices({ subjectType: 'place', id: live.id, notices: rows }, 'mcp')
    const today = noticeToday(new Date())

    await rejects(set([row({ kind: 'relocation' })]), 400, /адрес/)
    await rejects(set([row({ address: 'ул. Ленина, 5А' })]), 400, /только для переезда/)
    await rejects(set([row({ from: today, to: shift(today, -1) })]), 400, /раньше/)
    await rejects(set([row({ to: null })]), 400, /причина/)
    await rejects(set([row({ openEndedReason: 'Источник не сообщил' })]), 400, /не нужна/)
    await rejects(set([row({ from: '2026-02-30' })]), 400, /ГГГГ-ММ-ДД/)
    await rejects(set([row({ checkedAt: shift(today, 1) })]), 400, /позже сегодняшней/)
    await rejects(set([row({ text: 'Музей пока закрыт.' })]), 400, /«пока»/)
    await rejects(set([row({ text: 'Открыто с 10:00.' })]), 400, /расписании/)
    await rejects(set([row({ text: 'Вход 300 ₽.' })]), 400, /цены/)
    await rejects(set([row({ text: 'Музей закрыт на днях.' })]), 400, /на днях/)
    await rejects(set([row({ sourceUrl: VK_POST })]), 400, /официальный сайт места/)
    await rejects(set([row({ sourceUrl: 'https://yandex.ru/maps/org/123' })]), 400, /официальный сайт/)
    await rejects(
      set([row(), row({ kind: 'renovation', from: shift(today, 2), to: shift(today, 9) })]),
      400,
      /не могут пересекаться/,
    )
    await rejects(set([row(), row({ from: shift(today, 3), to: shift(today, 8) })]), 400, /пересекаются/)
    await rejects(
      set([
        row(),
        row({ kind: 'other', from: shift(today, 10), to: shift(today, 11) }),
        row({ kind: 'other', from: shift(today, 12), to: shift(today, 13) }),
        row({ kind: 'other', from: shift(today, 14), to: shift(today, 15) }),
        row({ kind: 'other', from: shift(today, 16), to: shift(today, 17) }),
      ]),
      400,
      /Не больше 4/,
    )
    await rejects(set([row({ id: 'not-a-stored-id' })]), 400, /не найдено/)

    const saved = await set([
      row({
        to: null,
        openEndedReason: 'На странице музея нет даты окончания',
        text: 'Год 2026 и дата 1 мая в тексте можно.',
      }),
      row({ kind: 'renovation', from: shift(today, -20), to: shift(today, -2), text: 'Шла реконструкция.' }),
    ])
    if (saved.pendingReview) {
      throw new Error('expected a live write')
    }
    expect(saved.notices.map((item) => item.kind).sort()).toEqual(['closed', 'renovation'])
    expect(saved.notices.find((item) => item.kind === 'renovation')?.state).toBe('expired')
    expect(await Editor.placeById(live.id)).toMatchObject({ publicationStatus: 'published' })
    const audits = await useDatabase()
      .select()
      .from(mcpAudits)
      .where(and(eq(mcpAudits.entityId, live.id), eq(mcpAudits.tool, 'notices_set')))
    expect(audits).toHaveLength(1)
  })

  it('replaces the list: an id updates, a missing id deletes, an empty list clears', async () => {
    const live = await place('notice-replace')
    enterContentScope('editor')
    const first = await setNotices(
      { subjectType: 'place', id: live.id, notices: [row(), row({ kind: 'other', text: 'Вход со двора.' })] },
      'admin',
    )
    const closed = first.notices.find((item) => item.kind === 'closed')!
    const second = await setNotices(
      {
        subjectType: 'place',
        id: live.id,
        notices: [{ ...row({ text: 'Музей закрыт, выставка переезжает.' }), id: closed.id }],
      },
      'admin',
    )
    expect(second.notices).toHaveLength(1)
    expect(second.notices[0]?.id).toBe(closed.id)
    expect(second.notices[0]?.text).toBe('Музей закрыт, выставка переезжает.')
    await setNotices({ subjectType: 'place', id: live.id, notices: [] }, 'admin')
    expect(await Notices.forSubject('place', live.id)).toHaveLength(0)
  })

  it("takes a venue's own VK community and refuses another one", async () => {
    const cafe = await venue('notice-vk')
    enterContentScope('editor')
    const relocation = row({
      kind: 'relocation',
      address: 'ул. Ленина, 5А',
      text: 'Кафе работает по этому адресу.',
      sourceUrl: VK_POST,
      sourceTitle: 'Пост сообщества',
    })
    const saved = await setNotices({ subjectType: 'venue', id: cafe.id, notices: [relocation] }, 'mcp')
    expect(saved.notices[0]?.address).toBe('ул. Ленина, 5А')
    await rejects(
      setNotices(
        { subjectType: 'venue', id: cafe.id, notices: [{ ...relocation, sourceUrl: 'https://vk.com/wall-999_1' }] },
        'mcp',
      ),
      400,
      /сообщество/,
    )
    const stored = await Venues.byId(cafe.id)
    expect(stored?.address).toBe('ул. Вокзальная, 1')
    expect(stored?.latitude).toBe(54.7)
  })

  it('writes live for a draft place with the draft token', async () => {
    const draft = await place('notice-draft-place', 'draft')
    enterContentScope('draft')
    const saved = await setNotices({ subjectType: 'place', id: draft.id, notices: [row()] }, 'mcp')
    expect(saved.pendingReview).toBe(false)
    expect(await Notices.forSubject('place', draft.id)).toHaveLength(1)
    expect(await Editor.contentDraft('place', draft.id)).toBeNull()
  })

  it('stages a draft-token write on a live place, keeps it through a page draft, and applies both', async () => {
    const live = await place('notice-stage-place')
    enterContentScope('draft')
    const staged = await setNotices({ subjectType: 'place', id: live.id, notices: [row()] }, 'mcp')
    expect(staged.pendingReview).toBe(true)
    expect(await Notices.forSubject('place', live.id)).toHaveLength(0)
    expect((await loadPublicNotices('place', [live.id])).get(live.id)).toEqual([])

    await updatePlaceDraft({ slug: live.slug, summary: 'Музей в старом доме у реки, с садом.' }, 'place_update')
    const view = await noticesView({ type: 'place', id: live.id })
    expect(view.notices).toHaveLength(0)
    expect(view.pendingReview?.notices).toHaveLength(1)

    enterContentScope('editor')
    const diff = await adminPlaceDraftView(live.id)
    expect(diff.pending?.noticesOnly).toBe(false)
    expect(diff.pending?.changes.map((change) => change.field)).toEqual(expect.arrayContaining(['summary', 'notices']))

    await setPublication({ entity: 'place', id: live.id, publicationStatus: 'published' })
    expect(await Notices.forSubject('place', live.id)).toHaveLength(1)
    expect((await Editor.placeById(live.id))?.summary).toBe('Музей в старом доме у реки, с садом.')
    expect(await Editor.contentDraft('place', live.id)).toBeNull()
  })

  it('applies a notices-only draft on an archived place without publishing it', async () => {
    const archived = await place('notice-archived-place', 'archived')
    enterContentScope('draft')
    await setNotices({ subjectType: 'place', id: archived.id, notices: [row()] }, 'mcp')
    await rejects(setPublication({ entity: 'place', id: archived.id, publicationStatus: 'published' }), 403)

    enterContentScope('editor')
    const diff = await adminPlaceDraftView(archived.id)
    expect(diff.pending?.noticesOnly).toBe(true)
    expect(diff.pending?.changes.map((change) => change.field)).toEqual(['notices'])
    await setPublication({ entity: 'place', id: archived.id, publicationStatus: 'published' })
    expect((await Editor.placeById(archived.id))?.publicationStatus).toBe('archived')
    expect(await Notices.forSubject('place', archived.id)).toHaveLength(1)
    expect(await Editor.contentDraft('place', archived.id)).toBeNull()
  })

  it('stages on a published venue, refuses an archived one, and applies through the venue entity', async () => {
    const cafe = await venue('notice-stage-venue')
    const gone = await venue('notice-archived-venue', 'archived')
    enterContentScope('draft')
    await rejects(
      setNotices({ subjectType: 'venue', id: gone.id, notices: [row()] }, 'mcp'),
      409,
      /live page was not changed/,
    )
    expect(await Editor.contentDraft('venue', gone.id)).toBeNull()

    const staged = await setNotices(
      { subjectType: 'venue', id: cafe.id, notices: [row({ text: 'Кафе не работает.' })] },
      'mcp',
    )
    expect(staged.pendingReview).toBe(true)
    const again = await setNotices(
      { subjectType: 'venue', id: cafe.id, notices: [row({ text: 'Кафе не принимает гостей.' })] },
      'mcp',
    )
    expect(again.notices[0]?.text).toBe('Кафе не принимает гостей.')
    expect(await Notices.forSubject('venue', cafe.id)).toHaveLength(0)
    await rejects(setPublication({ entity: 'venue', id: cafe.id, publicationStatus: 'published' }), 403)

    enterContentScope('editor')
    const target = await practicalTarget('venue', cafe.id)
    const admin = await adminNoticesView(target)
    expect(admin.pending?.changes[0]?.draft).toContain('Кафе не принимает гостей.')
    await decideVenueNoticeDraft(target, 'apply', admin.pending?.updatedAt)
    const live = await Notices.forSubject('venue', cafe.id)
    expect(live.map((item) => item.text)).toEqual(['Кафе не принимает гостей.'])
    expect((await Venues.byId(cafe.id))?.status).toBe('published')
    expect(await Editor.contentDraft('venue', cafe.id)).toBeNull()
    await rejects(
      setPublication({ entity: 'venue', id: cafe.id, publicationStatus: 'published' }),
      409,
      /Черновика нет/,
    )
  })

  it('discards or applies only the venue draft the editor saw', async () => {
    const cafe = await venue('notice-discard-race')
    enterContentScope('draft')
    await setNotices({ subjectType: 'venue', id: cafe.id, notices: [row({ text: 'Кафе не работает.' })] }, 'mcp')
    enterContentScope('editor')
    const target = await practicalTarget('venue', cafe.id)
    const seen = (await adminNoticesView(target)).pending?.updatedAt
    expect(seen).toBeTruthy()

    await new Promise((resolve) => setTimeout(resolve, 5))
    enterContentScope('draft')
    await setNotices(
      { subjectType: 'venue', id: cafe.id, notices: [row({ text: 'Кафе не принимает гостей.' })] },
      'mcp',
    )
    enterContentScope('editor')

    await rejects(decideVenueNoticeDraft(target, 'discard', seen), 409, /изменился/)
    await rejects(decideVenueNoticeDraft(target, 'apply', seen), 409, /изменился/)
    await rejects(decideVenueNoticeDraft(target, 'discard', undefined), 409, /изменился/)
    expect(stagedText(await Editor.contentDraft('venue', cafe.id))).toBe('Кафе не принимает гостей.')
    expect(await Notices.forSubject('venue', cafe.id)).toHaveLength(0)

    const fresh = (await adminNoticesView(target)).pending?.updatedAt
    expect(await decideVenueNoticeDraft(target, 'discard', fresh)).toEqual({ discarded: true })
    expect(await Editor.contentDraft('venue', cafe.id)).toBeNull()
    expect(await Notices.forSubject('venue', cafe.id)).toHaveLength(0)
    await rejects(decideVenueNoticeDraft(target, 'discard', fresh), 409, /Черновика нет/)
  })

  it('drops the whole pending draft on an editor write, and the admin save asks first', async () => {
    const live = await place('notice-editor-drops')
    enterContentScope('draft')
    await updatePlaceDraft({ slug: live.slug, summary: 'Другое описание музея у реки.' }, 'place_update')
    enterContentScope('editor')
    await rejects(setNotices({ subjectType: 'place', id: live.id, notices: [row()] }, 'admin'), 409, /черновик/)
    expect(await Editor.contentDraft('place', live.id)).not.toBeNull()
    const discarded = await setNotices(
      { subjectType: 'place', id: live.id, notices: [row()], pendingDraft: 'discard' },
      'admin',
    )
    expect(discarded).toMatchObject({ pendingReview: false, draftDropped: true })
    expect(await Editor.contentDraft('place', live.id)).toBeNull()

    enterContentScope('draft')
    await updatePlaceDraft({ slug: live.slug, summary: 'Третье описание музея у реки.' }, 'place_update')
    enterContentScope('editor')
    const cleared = await setNotices({ subjectType: 'place', id: live.id, notices: [] }, 'mcp')
    expect(cleared).toMatchObject({ pendingReview: false, draftDropped: true })
    expect(await Editor.contentDraft('place', live.id)).toBeNull()
    expect(await setNotices({ subjectType: 'place', id: live.id, notices: [] }, 'mcp')).toMatchObject({
      draftDropped: false,
    })
    expect((await Editor.placeById(live.id))?.summary).toBe('Музей в старом доме у реки.')
  })
})

describe('notices public read', () => {
  it('shows upcoming and current rows and hides a row the day after it ends, in Kaliningrad time', async () => {
    const live = await place('notice-window')
    await Notices.replace('place', live.id, [
      {
        kind: 'relocation',
        startsOn: '2026-11-01',
        endsOn: '2026-11-13',
        openEndedReason: null,
        text: 'Кафе работает по этому адресу.',
        address: 'ул. Ленина, 5А',
        sourceUrl: SITE,
        sourceTitle: 'Новости',
        checkedAt: '2026-10-20',
      },
      {
        kind: 'closed',
        startsOn: '2026-11-20',
        endsOn: '2026-11-21',
        openEndedReason: null,
        text: 'Закрыто на учёт.',
        address: null,
        sourceUrl: 'https://museum-notice.example.ru/news/2',
        sourceTitle: 'Новости 2',
        checkedAt: '2026-10-20',
      },
    ])
    const read = async (at: string) => (await loadPublicNotices('place', [live.id], new Date(at))).get(live.id) ?? []

    const before = await read('2026-10-31T12:00:00Z')
    expect(before.map((item) => [item.kind, item.state])).toEqual([
      ['closed', 'upcoming'],
      ['relocation', 'upcoming'],
    ])
    // 22:30 UTC on 31 October is already 1 November in Kaliningrad.
    expect((await read('2026-10-31T22:30:00Z'))[0]).toMatchObject({ kind: 'relocation', state: 'current' })
    expect((await read('2026-11-13T21:30:00Z'))[0]).toMatchObject({ kind: 'relocation', state: 'current' })
    expect((await read('2026-11-13T22:30:00Z')).map((item) => item.kind)).toEqual(['closed'])
    expect(await read('2026-11-22T00:00:00Z')).toEqual([])

    const shown = await read('2026-11-05T10:00:00Z')
    const sources = sourcesWithNotices([{ title: 'Сайт', url: SITE }], shown)
    expect(sources).toEqual([
      { title: 'Сайт', url: SITE },
      { title: 'Новости 2', url: 'https://museum-notice.example.ru/news/2' },
    ])
  })

  it('flags expired rows without deleting them', async () => {
    const live = await place('notice-expire')
    await Notices.replace('place', live.id, [
      {
        kind: 'other',
        startsOn: '2020-01-01',
        endsOn: '2020-01-02',
        openEndedReason: null,
        text: 'Старое объявление.',
        address: null,
        sourceUrl: SITE,
        sourceTitle: 'Новости',
        checkedAt: '2020-01-01',
      },
    ])
    expect(await Notices.flagExpired('2026-10-22')).toBeGreaterThanOrEqual(1)
    const [stored] = await Notices.forSubject('place', live.id)
    expect(stored?.expiredAt).not.toBeNull()
    const expired = await Notices.list({ expired: true, today: '2026-10-22' })
    expect(expired.some((item) => item.notice.subjectId === live.id && item.subjectSlug === live.slug)).toBe(true)
  })
})

describe('closed notice status', () => {
  it('makes the availability answer closed without writing hours, only inside the window', async () => {
    const cafe = await venue('notice-availability')
    const noHours = await venue('notice-availability-nohours')
    const always = {
      mode: 'always',
      seasons: [],
      closures: [],
      holidays: 'as-usual',
      exceptions: [],
      occurrences: [],
      needsCheck: false,
    }
    await Schedules.save(
      { entityType: 'venue', entityId: cafe.id, rules: always, sourceUrl: SITE, verifiedAt: '2026-10-20' },
      [],
    )
    const write = {
      kind: 'closed' as const,
      startsOn: '2026-11-01',
      endsOn: '2026-11-13',
      openEndedReason: null,
      text: 'Кафе не работает.',
      address: null,
      sourceUrl: SITE,
      sourceTitle: 'Новости',
      checkedAt: '2026-10-20',
    }
    await Notices.replace('venue', cafe.id, [write])
    await Notices.replace('venue', noHours.id, [write])

    const inside = new Date('2026-11-05T12:00:00Z')
    const rows = await Schedules.availability(inside.toISOString(), { types: ['venue'] })
    const own = rows.find((item) => item.entityId === cafe.id)
    expect(own?.closedNotices).toEqual([{ kind: 'closed', from: '2026-11-01', to: '2026-11-13' }])
    expect(rows.find((item) => item.entityId === noHours.id)?.closedNotices).toHaveLength(1)
    const value = withNoticeStatus(
      { status: 'open', closesAt: null, opensAt: null, minutesLeft: null, minutesToOpen: null },
      own?.closedNotices,
      inside,
    )
    expect(value.status).toBe('closed')
    expect(value.opensAt).toBeNull()
    expect(liveStatusText(value, inside)).toBe('Закрыто с 1 ноября 2026 по 13 ноября 2026')

    const after = await Schedules.availability('2026-11-13T22:30:00Z', { types: ['venue'] })
    expect(after.find((item) => item.entityId === cafe.id)?.closedNotices).toEqual([])
    expect(after.some((item) => item.entityId === noHours.id)).toBe(false)
    expect((await Schedules.get('venue', cafe.id))?.rules).toEqual(always)
  })
})
