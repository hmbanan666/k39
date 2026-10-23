// Lives in the database suite so it uses that Postgres.
// The .writer.test.ts suffix is the typecheck rule: this package's tsc
// excludes it, and scripts/typecheck-writer.mjs includes every match.
import { and, eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import placeGet from '../../../../../apps/web-app/server/mcp/tools/place-get'
import { enterContentScope } from '../../../../../apps/web-app/server/utils/access'
import { adminPlaceDraftView, applyAdminPlaceDraft, discardAdminPlaceDraft, saveAdminPlace } from '../../../../../apps/web-app/server/utils/admin/place-draft'
import { placeWriteFromBody, updatePlaceDraft } from '../../../../../apps/web-app/server/utils/mcp/places'
import { setPublication } from '../../../../../apps/web-app/server/utils/mcp/publish'
import { useDatabase } from '../../database'
import { contentDrafts, facts, mcpAudits, pageReviews, places, revisions, verificationQueue } from '../../tables'
import { Editor } from '../content'

const ids: string[] = []

afterEach(async () => {
  const database = useDatabase()
  for (const id of ids) {
    await database.delete(verificationQueue).where(eq(verificationQueue.entityId, id))
    await database.delete(pageReviews).where(eq(pageReviews.entityId, id))
    await database.delete(facts).where(and(eq(facts.subjectType, 'place'), eq(facts.subjectId, id)))
    await database.delete(contentDrafts).where(eq(contentDrafts.entityId, id))
    await database.delete(revisions).where(eq(revisions.entityId, id))
    await database.delete(mcpAudits).where(eq(mcpAudits.entityId, id))
    await database.delete(places).where(eq(places.id, id))
  }
  ids.length = 0
})

async function publishedPlace(slug: string) {
  const row = await Editor.savePlace({
    slug,
    title: 'Старый заголовок',
    summary: 'Старое описание',
    body: 'Старый текст страницы.',
    publicationStatus: 'published',
    faq: [],
    visitDuration: 'час',
  })
  ids.push(row.id)
  return row
}

const draftBody = 'Новый текст страницы про вокзал и площадь.'

function withDraftLengths(value: object) {
  if (!('pendingReview' in value) || !('bodyLength' in value) || typeof value.bodyLength !== 'number') {
    throw new Error('expected pendingReview and bodyLength')
  }
  return value as typeof value & {
    pendingReview: boolean
    bodyLength: number
    renderedFields?: readonly string[]
    publicationStatus: string
    title: string
  }
}

describe('pending place publish', () => {
  it('re-saves a checked place and round-trips the actual place_get date without touching live content', async () => {
    const live = await publishedPlace('pending-date-round-trip')
    await useDatabase().update(places).set({ lastVerifiedAt: '2026-10-12T00:00:00.123456Z' }).where(eq(places.id, live.id))
    enterContentScope('draft')
    const fetched = await placeGet.handler({ id: live.id, slug: undefined }, {} as Parameters<typeof placeGet.handler>[1])
    if (!fetched || typeof fetched !== 'object' || !('factsCheckedAt' in fetched) || typeof fetched.factsCheckedAt !== 'string') {
      throw new Error('place_get omitted its factsCheckedAt timestamp')
    }
    const liveDate = fetched.factsCheckedAt
    await updatePlaceDraft({ id: live.id, title: 'Первый черновик даты', body: draftBody }, 'place_update')
    await updatePlaceDraft({ id: live.id, faq: [{ question: 'Где вход?', answer: 'У площади.' }] }, 'place_draft_update')
    expect((await Editor.contentDraft('place', live.id))?.payload.lastVerifiedAt).toBe(liveDate)
    await updatePlaceDraft({ id: live.id, bestTime: 'Утром', factsCheckedAt: liveDate }, 'place_update')
    await updatePlaceDraft({ id: live.id, visitDuration: 'два часа' }, 'place_update')

    const pending = await Editor.contentDraft('place', live.id)
    expect(pending?.payload).toMatchObject({
      title: 'Первый черновик даты', body: draftBody, bestTime: 'Утром', visitDuration: 'два часа',
      faq: [{ question: 'Где вход?', answer: 'У площади.' }],
      lastVerifiedAt: '2026-10-12T00:00:00.123Z',
    })
    const still = await Editor.placeById(live.id)
    expect(still?.body).toBe(live.body)
    expect(still?.title).toBe(live.title)
    expect(still?.lastVerifiedAt).toBe(liveDate)
    expect(still?.publicationStatus).toBe('published')
    enterContentScope('editor')
    await setPublication({ entity: 'place', slug: live.slug, publicationStatus: 'published' })
    const applied = await Editor.placeById(live.id)
    expect(applied?.title).toBe('Первый черновик даты')
    expect(new Date(applied!.lastVerifiedAt!).toISOString()).toBe('2026-10-12T00:00:00.123Z')
  })

  it('keeps an explicit date clear through another pending save and editor publication', async () => {
    const live = await publishedPlace('pending-date-clear')
    await useDatabase().update(places).set({ lastVerifiedAt: '2026-10-12T00:00:00.000Z' }).where(eq(places.id, live.id))
    enterContentScope('draft')
    await updatePlaceDraft({ id: live.id, factsCheckedAt: null }, 'place_update')
    await updatePlaceDraft({ id: live.id, body: draftBody }, 'place_update')
    expect((await Editor.contentDraft('place', live.id))?.payload.lastVerifiedAt).toBeNull()
    expect((await Editor.placeById(live.id))?.lastVerifiedAt).not.toBeNull()
    enterContentScope('editor')
    await setPublication({ entity: 'place', slug: live.slug, publicationStatus: 'published' })
    expect((await Editor.placeById(live.id))?.lastVerifiedAt).toBeNull()
  })

  it('keeps a replacement date when the following pending write omits it', async () => {
    const live = await publishedPlace('pending-date-replace')
    await useDatabase().update(places).set({ lastVerifiedAt: '2026-10-12T00:00:00.000Z' }).where(eq(places.id, live.id))
    enterContentScope('draft')
    await updatePlaceDraft({ id: live.id, factsCheckedAt: '2026-10-20 15:04:05+02', body: draftBody }, 'place_update')
    await updatePlaceDraft({ id: live.id, bestTime: 'Днём' }, 'place_update')
    expect((await Editor.contentDraft('place', live.id))?.payload.lastVerifiedAt).toBe('2026-10-20T13:04:05.000Z')
    expect(new Date((await Editor.placeById(live.id))!.lastVerifiedAt!).toISOString()).toBe('2026-10-12T00:00:00.000Z')
    enterContentScope('editor')
    await setPublication({ entity: 'place', slug: live.slug, publicationStatus: 'published' })
    expect(new Date((await Editor.placeById(live.id))!.lastVerifiedAt!).toISOString()).toBe('2026-10-20T13:04:05.000Z')
  })

  it('stores a draft-token write, then an editor publish applies it', async () => {
    const live = await publishedPlace('pending-mcp')
    enterContentScope('draft')
    const written = withDraftLengths(await updatePlaceDraft({
      slug: live.slug,
      title: 'Новый заголовок',
      summary: 'Новое описание',
      body: draftBody,
      faq: [{ question: 'Где вокзал?', answer: 'У площади, в двух минутах от реки.' }],
      visitDuration: '1–2 часа',
    }, 'place_update'))

    expect(written.pendingReview).toBe(true)
    expect(written.bodyLength).toBe(draftBody.length)
    expect(written.renderedFields).toContain('body')
    expect(written.publicationStatus).toBe('published')
    expect(written.title).toBe('Новый заголовок')
    const still = await Editor.placeById(live.id)
    expect(still?.body).toBe('Старый текст страницы.')
    expect(still?.title).toBe('Старый заголовок')

    enterContentScope('editor')
    const published = withDraftLengths(await setPublication({
      entity: 'place',
      slug: live.slug,
      publicationStatus: 'published',
    }))
    const row = await Editor.placeById(live.id)
    expect(row?.title).toBe('Новый заголовок')
    expect(row?.summary).toBe('Новое описание')
    expect(row?.body).toBe(draftBody)
    expect(row?.visitDuration).toBe('1–2 часа')
    expect(row?.faq).toEqual([{ question: 'Где вокзал?', answer: 'У площади, в двух минутах от реки.' }])
    expect(row?.publicationStatus).toBe('published')
    expect(await Editor.contentDraft('place', live.id)).toBeNull()
    expect(published.pendingReview).toBe(false)
    expect(published.bodyLength).toBe(draftBody.length)
  })

  it('applies the same pending payload through the REST place writer', async () => {
    const live = await publishedPlace('pending-rest')
    enterContentScope('draft')
    const written = withDraftLengths(await updatePlaceDraft(placeWriteFromBody({
      body: draftBody,
      title: 'Заголовок из REST',
      summary: 'Описание из REST',
    }, { id: live.id, slug: live.slug }), 'place_update'))
    expect(written.pendingReview).toBe(true)
    expect(written.bodyLength).toBe(draftBody.length)
    expect(written.renderedFields).toContain('body')

    enterContentScope('editor')
    await updatePlaceDraft(placeWriteFromBody({
      publicationStatus: 'published',
    }, { id: live.id, slug: live.slug }), 'place_update')
    const row = await Editor.placeById(live.id)
    expect(row?.title).toBe('Заголовок из REST')
    expect(row?.summary).toBe('Описание из REST')
    expect(row?.body).toBe(draftBody)
    expect(await Editor.contentDraft('place', live.id)).toBeNull()
  })

  it('discards a pending draft when an editor writes the live row', async () => {
    const live = await publishedPlace('pending-discard')
    enterContentScope('draft')
    await updatePlaceDraft({ id: live.id, body: 'Текст черновика, который редактор заменяет.' }, 'place_update')
    enterContentScope('editor')
    const editorBody = 'Текст редактора на живой странице.'
    const written = await updatePlaceDraft({ id: live.id, body: editorBody }, 'place_update')
    const row = await Editor.placeById(live.id)
    expect(row?.body).toBe(editorBody)
    expect(written).toMatchObject({ draftDropped: true, pendingReview: false })
    expect(await Editor.contentDraft('place', live.id)).toBeNull()
  })

  it('shows a pending draft as field changes and refuses an admin save until the editor chooses', async () => {
    const live = await publishedPlace('admin-choice')
    enterContentScope('draft')
    await updatePlaceDraft({
      id: live.id,
      title: 'Новый заголовок',
      body: draftBody,
    }, 'place_update')
    enterContentScope('editor')

    const view = await adminPlaceDraftView(live.id)
    expect(view.pending?.changes.map((item) => item.field)).toEqual(['title', 'body'])
    expect(view.pending?.changes[0]).toMatchObject({ live: 'Старый заголовок', draft: 'Новый заголовок' })
    expect(view.pending?.publicationStatus).toBe('review')

    await expect(saveAdminPlace(live.id, {
      title: 'Правка редактора',
      body: 'Текст формы редактора на живой странице.',
      publicationStatus: 'published',
    }, null)).rejects.toMatchObject({ statusCode: 409 })

    const row = await Editor.placeById(live.id)
    expect(row?.title).toBe('Старый заголовок')
    expect(row?.body).toBe('Старый текст страницы.')
    expect((await Editor.contentDraft('place', live.id))?.payload).toMatchObject({ body: draftBody })
  })

  it('writes the admin form and deletes the draft only when discard is explicit', async () => {
    const live = await publishedPlace('admin-discard-save')
    enterContentScope('draft')
    await updatePlaceDraft({ id: live.id, body: draftBody }, 'place_update')
    enterContentScope('editor')
    const editorBody = 'Текст формы редактора на живой странице.'
    await saveAdminPlace(live.id, {
      body: editorBody,
      publicationStatus: 'published',
      pendingDraft: 'discard',
    }, null)
    const row = await Editor.placeById(live.id)
    expect(row?.body).toBe(editorBody)
    expect(row?.title).toBe('Старый заголовок')
    expect(await Editor.contentDraft('place', live.id)).toBeNull()
  })

  it('keeps the draft when the admin save is rejected', async () => {
    const live = await publishedPlace('admin-save-rejected')
    enterContentScope('draft')
    await updatePlaceDraft({ id: live.id, body: draftBody }, 'place_update')
    enterContentScope('editor')
    await expect(saveAdminPlace(live.id, {
      body: 'Это уютная атмосфера у вокзала.',
      publicationStatus: 'published',
      pendingDraft: 'discard',
    }, null)).rejects.toMatchObject({ statusCode: 400 })
    expect((await Editor.placeById(live.id))?.body).toBe('Старый текст страницы.')
    expect(await Editor.contentDraft('place', live.id)).not.toBeNull()
  })

  it('discards a pending draft without changing the live row', async () => {
    const live = await publishedPlace('admin-discard')
    enterContentScope('draft')
    await updatePlaceDraft({ id: live.id, title: 'Новый заголовок', body: draftBody }, 'place_update')
    enterContentScope('editor')
    await discardAdminPlaceDraft(live.id)
    const row = await Editor.placeById(live.id)
    expect(row?.title).toBe('Старый заголовок')
    expect(row?.body).toBe('Старый текст страницы.')
    expect(await Editor.contentDraft('place', live.id)).toBeNull()
    expect(await adminPlaceDraftView(live.id)).toEqual({ pending: null })
  })

  it('applies a pending draft from the admin action through the publication writer', async () => {
    const live = await publishedPlace('admin-apply')
    enterContentScope('draft')
    await updatePlaceDraft({
      id: live.id,
      title: 'Новый заголовок',
      summary: 'Новое описание',
      body: draftBody,
    }, 'place_update')
    enterContentScope('draft')
    const published = withDraftLengths(await applyAdminPlaceDraft(live.id))
    const row = await Editor.placeById(live.id)
    expect(row?.title).toBe('Новый заголовок')
    expect(row?.summary).toBe('Новое описание')
    expect(row?.body).toBe(draftBody)
    expect(row?.publicationStatus).toBe('published')
    expect(await Editor.contentDraft('place', live.id)).toBeNull()
    expect(published.pendingReview).toBe(false)
    expect(published.bodyLength).toBe(draftBody.length)
    await expect(applyAdminPlaceDraft(live.id)).rejects.toMatchObject({ statusCode: 409 })
  })
})
