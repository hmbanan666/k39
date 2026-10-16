// Lives in the database suite so it uses that Postgres. Excluded from this
// package's tsc: the writer is Nuxt code with auto-imports.
import { and, eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
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

describe('pending place publish', () => {
  it('stores a draft-token write, then an editor publish applies it', async () => {
    const live = await publishedPlace('pending-mcp')
    enterContentScope('draft')
    const written = await updatePlaceDraft({
      slug: live.slug,
      title: 'Новый заголовок',
      summary: 'Новое описание',
      body: draftBody,
      faq: [{ question: 'Где вокзал?', answer: 'У площади, в двух минутах от реки.' }],
      visitDuration: '1–2 часа',
    }, 'place_update')

    expect(written.pendingReview).toBe(true)
    expect(written.bodyLength).toBe(draftBody.length)
    expect(written.renderedFields).toContain('body')
    expect(written.publicationStatus).toBe('published')
    expect(written.title).toBe('Новый заголовок')
    const still = await Editor.placeById(live.id)
    expect(still?.body).toBe('Старый текст страницы.')
    expect(still?.title).toBe('Старый заголовок')

    enterContentScope('editor')
    const published = await setPublication({
      entity: 'place',
      slug: live.slug,
      publicationStatus: 'published',
    })
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
    const written = await updatePlaceDraft(placeWriteFromBody({
      body: draftBody,
      title: 'Заголовок из REST',
      summary: 'Описание из REST',
    }, { id: live.id, slug: live.slug }), 'place_update')
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
    await updatePlaceDraft({ id: live.id, body: editorBody }, 'place_update')
    const row = await Editor.placeById(live.id)
    expect(row?.body).toBe(editorBody)
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
    const published = await applyAdminPlaceDraft(live.id)
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
