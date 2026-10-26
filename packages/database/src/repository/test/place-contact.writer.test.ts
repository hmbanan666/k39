// Lives in the database suite so it uses that Postgres.
// Typechecked from apps/web-app/tsconfig.writer-test.json, where Nuxt
// auto-imports exist. This package's tsc excludes the file.
import { and, eq, inArray } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { enterContentScope } from '../../../../../apps/web-app/server/utils/access'
import { adminPlaceDraftView, saveAdminPlace } from '../../../../../apps/web-app/server/utils/admin/place-draft'
import { readShownFacts } from '../../../../../apps/web-app/server/utils/facts/read'
import { syncPlacePhone } from '../../../../../apps/web-app/server/utils/facts/sync'
import {
  createPlaceDraft,
  placeWriteFromBody,
  updatePlaceDraft,
} from '../../../../../apps/web-app/server/utils/mcp/places'
import { setPublication } from '../../../../../apps/web-app/server/utils/mcp/publish'
import { useDatabase } from '../../database'
import { SOURCE_LINK_LIMIT } from '../../sources'
import {
  categories,
  contentDrafts,
  factRefs,
  facts,
  mcpAudits,
  pageReviews,
  places,
  revisions,
  sourceDocuments,
  verificationQueue,
} from '../../tables'
import { Editor } from '../content'

const SITE = 'https://contact-museum.example.org/'
const CONTACTS = 'https://contact-museum.example.org/kontakty'
const HUB = 'contact-test-hub'
const ids: string[] = []

beforeAll(async () => {
  await useDatabase()
    .insert(categories)
    .values({ slug: HUB, title: 'Музеи', description: 'Раздел для проверки контактов.' })
    .onConflictDoNothing()
})

afterEach(async () => {
  const database = useDatabase()
  enterContentScope('editor')
  for (const id of ids) {
    await database.delete(verificationQueue).where(eq(verificationQueue.entityId, id))
    await database.delete(pageReviews).where(eq(pageReviews.entityId, id))
    await database.delete(facts).where(and(eq(facts.subjectType, 'place'), eq(facts.subjectId, id)))
    await database.delete(contentDrafts).where(eq(contentDrafts.entityId, id))
    await database.delete(revisions).where(eq(revisions.entityId, id))
    await database.delete(mcpAudits).where(eq(mcpAudits.entityId, id))
    await database.delete(places).where(eq(places.id, id))
  }
  await database
    .delete(sourceDocuments)
    .where(inArray(sourceDocuments.url, [SITE, CONTACTS, 'https://vk.com/contact_museum']))
  ids.length = 0
})

afterAll(async () => {
  await useDatabase().delete(categories).where(eq(categories.slug, HUB))
})

async function phoneFact(placeId: string) {
  const [row] = await useDatabase()
    .select()
    .from(facts)
    .where(and(eq(facts.subjectType, 'place'), eq(facts.subjectId, placeId), eq(facts.slot, 'phone')))
    .orderBy(facts.updatedAt)
  return row ?? null
}

async function livePhoneFact(placeId: string) {
  return slotFact(placeId, 'phone')
}

async function slotFact(placeId: string, slot: string) {
  const rows = await useDatabase()
    .select()
    .from(facts)
    .where(and(eq(facts.subjectType, 'place'), eq(facts.subjectId, placeId), eq(facts.slot, slot)))
  return rows.find((row) => !row.retiredAt) ?? null
}

async function created(slug: string, extra: Parameters<typeof createPlaceDraft>[0] = {}) {
  const row = await createPlaceDraft({
    slug,
    categorySlug: HUB,
    title: 'Музей контактов',
    summary: 'Проверка контактов места.',
    body: 'Текст.',
    ...extra,
  })
  ids.push(row.id)
  return row
}

async function publishedPlace(slug: string) {
  const row = await Editor.savePlace({
    slug,
    title: 'Живая кирха',
    summary: 'Живое описание',
    body: 'Живой текст страницы.',
    publicationStatus: 'published',
  })
  ids.push(row.id)
  return row
}

describe('place phone, website and schema type writer', () => {
  it('stores the phone as an official fact with its source and shows it from the ledger', async () => {
    enterContentScope('editor')
    const row = await created('contact-create', {
      phone: '+7 4012 30-30-40',
      phoneSourceUrl: CONTACTS,
      website: SITE,
      schemaType: 'Church',
      factsCheckedAt: '2026-10-20',
    })
    expect(row).toMatchObject({ phone: '+7 4012 30-30-40', website: SITE, schemaType: 'Church' })
    const fact = await phoneFact(row.id)
    expect(fact).toMatchObject({
      kind: 'phone',
      value: { text: '+7 4012 30-30-40' },
      sourceUrl: CONTACTS,
      sourceKind: 'official',
      confidence: 'stated',
    })
    expect(fact?.checkedAt?.slice(0, 10)).toBe('2026-10-20')
    const refs = await useDatabase().select().from(factRefs).where(eq(factRefs.factId, fact!.id))
    expect(refs.map((ref) => ref.path)).toEqual(['short.phone'])
    const shown = (await readShownFacts('place', [{ id: row.id, phone: null }])).get(row.id)
    expect(shown?.phone).toBe('+7 4012 30-30-40')
  })

  it('falls back to the website as the phone source', async () => {
    enterContentScope('editor')
    const row = await created('contact-fallback', { phone: '+7 4012 30-30-40', website: SITE })
    expect((await phoneFact(row.id))?.sourceUrl).toBe(SITE)
  })

  it('accepts the place social page as the source and rejects maps, aggregators and social websites', async () => {
    enterContentScope('editor')
    const social = await created('contact-social', {
      phone: '+7 4012 30-30-40',
      phoneSourceUrl: 'https://vk.com/contact_museum',
    })
    expect((await phoneFact(social.id))?.sourceKind).toBe('official_social')

    await expect(created('contact-nosource', { phone: '+7 4012 30-30-40' })).rejects.toMatchObject({ statusCode: 400 })
    await expect(
      created('contact-map', { phone: '+7 4012 30-30-40', phoneSourceUrl: 'https://yandex.ru/maps/org/1' }),
    ).rejects.toMatchObject({ statusCode: 400 })
    await expect(
      created('contact-2gis', { phone: '+7 4012 30-30-40', website: 'https://2gis.ru/kaliningrad/firm/1' }),
    ).rejects.toMatchObject({ statusCode: 400 })
    await expect(created('contact-vk-site', { website: 'https://vk.com/contact_museum' })).rejects.toMatchObject({
      statusCode: 400,
    })
    await expect(created('contact-gap', { phone: 'уточняйте', website: SITE })).rejects.toMatchObject({
      statusCode: 400,
    })
    await expect(created('contact-type', { schemaType: 'Castle' })).rejects.toMatchObject({ statusCode: 400 })
    await expect(
      created('contact-trip', {
        phone: '+7 4012 30-30-40',
        phoneSourceUrl: 'https://www.tripadvisor.ru/Attraction_Review-g298500-d1.html',
      }),
    ).rejects.toMatchObject({ statusCode: 400 })
    await expect(
      created('contact-profile', { phone: '+7 4012 30-30-40', website: 'https://yandex.ru/profile/1234567890' }),
    ).rejects.toMatchObject({ statusCode: 400 })
    await expect(
      created('contact-vk-with-site', {
        phone: '+7 4012 30-30-40',
        phoneSourceUrl: 'https://vk.com/contact_museum',
        website: SITE,
      }),
    ).rejects.toMatchObject({ statusCode: 400 })
    for (const slug of [
      'contact-nosource',
      'contact-map',
      'contact-2gis',
      'contact-vk-site',
      'contact-gap',
      'contact-type',
      'contact-trip',
      'contact-profile',
      'contact-vk-with-site',
    ]) {
      expect(await Editor.placeBySlug(slug)).toBeUndefined()
    }
  })

  it('replaces the fact on a new number, keeps it on an unrelated edit, and retires it on clear', async () => {
    enterContentScope('editor')
    const row = await created('contact-update', { phone: '+7 4012 30-30-40', phoneSourceUrl: CONTACTS, website: SITE })
    const first = await livePhoneFact(row.id)

    await updatePlaceDraft({ id: row.id, summary: 'Новое описание места.' }, 'place_update')
    expect((await livePhoneFact(row.id))?.id).toBe(first?.id)
    expect((await livePhoneFact(row.id))?.valueHash).toBe(first?.valueHash)

    const changed = await updatePlaceDraft({ id: row.id, phone: '+7 911 851-68-55' }, 'place_update')
    expect(changed).toMatchObject({ phone: '+7 911 851-68-55', phoneSourceUrl: CONTACTS })
    expect((await livePhoneFact(row.id))?.value).toEqual({ text: '+7 911 851-68-55' })

    await updatePlaceDraft({ id: row.id, schemaType: 'Park' }, 'place_update')
    expect((await Editor.placeById(row.id))?.schemaType).toBe('Park')
    await updatePlaceDraft({ id: row.id, schemaType: null }, 'place_update')
    expect((await Editor.placeById(row.id))?.schemaType).toBeNull()

    await updatePlaceDraft({ id: row.id, phone: null }, 'place_update')
    expect((await Editor.placeById(row.id))?.phone).toBeNull()
    expect(await livePhoneFact(row.id)).toBeNull()
  })

  it('carries the contacts in the REST body', () => {
    const write = placeWriteFromBody(
      { phone: '+7 4012 30-30-40', phoneSourceUrl: CONTACTS, website: SITE, schemaType: 'Church' },
      { id: 'x', slug: 'x' },
    )
    expect(write).toMatchObject({
      phone: '+7 4012 30-30-40',
      phoneSourceUrl: CONTACTS,
      website: SITE,
      schemaType: 'Church',
    })
  })

  it('stores a draft-token contact write as a pending draft and writes the fact on publish', async () => {
    const live = await publishedPlace('contact-pending')
    enterContentScope('draft')
    const written = await updatePlaceDraft(
      {
        id: live.id,
        phone: '+7 4012 30-30-40',
        phoneSourceUrl: CONTACTS,
        website: SITE,
        schemaType: 'Church',
      },
      'place_update',
    )
    expect(written).toMatchObject({
      pendingReview: true,
      phone: '+7 4012 30-30-40',
      website: SITE,
      schemaType: 'Church',
      phoneSourceUrl: CONTACTS,
    })
    expect('renderedFields' in written && written.renderedFields).toEqual(expect.arrayContaining(['phone', 'website']))
    const still = await Editor.placeById(live.id)
    expect(still).toMatchObject({ phone: null, website: null, schemaType: null })
    expect(await livePhoneFact(live.id)).toBeNull()
    expect((await Editor.contentDraft('place', live.id))?.payload).toMatchObject({
      phone: '+7 4012 30-30-40',
      phoneSourceUrl: CONTACTS,
      website: SITE,
      schemaType: 'Church',
    })

    await updatePlaceDraft({ id: live.id, summary: 'Описание из второго черновика.' }, 'place_update')
    expect((await Editor.contentDraft('place', live.id))?.payload).toMatchObject({
      phone: '+7 4012 30-30-40',
      phoneSourceUrl: CONTACTS,
      schemaType: 'Church',
    })
    await expect(
      updatePlaceDraft(
        { id: live.id, phone: '+7 4012 30-30-40', phoneSourceUrl: 'https://2gis.ru/kaliningrad/firm/1' },
        'place_update',
      ),
    ).rejects.toMatchObject({ statusCode: 400 })

    enterContentScope('editor')
    const view = await adminPlaceDraftView(live.id)
    expect(view.pending?.changes.map((item) => item.field)).toEqual(
      expect.arrayContaining(['phone', 'website', 'schemaType']),
    )

    await setPublication({ entity: 'place', id: live.id, publicationStatus: 'published' })
    const row = await Editor.placeById(live.id)
    expect(row).toMatchObject({
      phone: '+7 4012 30-30-40',
      website: SITE,
      schemaType: 'Church',
      summary: 'Описание из второго черновика.',
    })
    expect(await livePhoneFact(live.id)).toMatchObject({
      value: { text: '+7 4012 30-30-40' },
      sourceUrl: CONTACTS,
      sourceKind: 'official',
    })
    expect(await Editor.contentDraft('place', live.id)).toBeNull()
  })

  it('keeps the live phone when the owner holds the fact and the editor applies a pending draft', async () => {
    const live = await publishedPlace('contact-owner')
    enterContentScope('editor')
    await updatePlaceDraft(
      { id: live.id, phone: '+7 4012 30-30-40', phoneSourceUrl: CONTACTS, website: SITE },
      'place_update',
    )
    await syncPlacePhone({
      placeId: live.id,
      actor: 'owner',
      pageStatus: 'published',
      phone: '+7 4012 30-30-40',
      sourceUrl: SITE,
      checkedAt: '2026-10-20',
    })
    enterContentScope('draft')
    await updatePlaceDraft(
      { id: live.id, phone: '+7 911 851-68-55', summary: 'Описание из черновика.' },
      'place_update',
    )
    enterContentScope('editor')
    await setPublication({ entity: 'place', id: live.id, publicationStatus: 'published' })
    expect(await Editor.placeById(live.id)).toMatchObject({
      phone: '+7 4012 30-30-40',
      summary: 'Описание из черновика.',
    })
    expect((await livePhoneFact(live.id))?.value).toEqual({ text: '+7 4012 30-30-40' })
    const queued = await useDatabase()
      .select()
      .from(verificationQueue)
      .where(and(eq(verificationQueue.entityId, live.id), eq(verificationQueue.reason, 'owner_conflict')))
    expect(queued).toHaveLength(1)
  })

  it('saves contacts from the admin form as the editor', async () => {
    const live = await publishedPlace('contact-admin')
    enterContentScope('editor')
    const saved = await saveAdminPlace(
      live.id,
      {
        phone: '+7 4012 30-30-40',
        phoneSourceUrl: '',
        website: SITE,
        schemaType: 'PerformingArtsTheater',
      },
      null,
    )
    expect(saved).toMatchObject({
      phone: '+7 4012 30-30-40',
      website: SITE,
      schemaType: 'PerformingArtsTheater',
      phoneSourceUrl: SITE,
    })
    const fact = await livePhoneFact(live.id)
    expect(fact).toMatchObject({ sourceUrl: SITE, sourceKind: 'official' })
    await expect(saveAdminPlace(live.id, { website: 'https://t.me/contact_museum' }, null)).rejects.toMatchObject({
      statusCode: 400,
    })
    await saveAdminPlace(live.id, { phone: '', website: '', schemaType: null }, null)
    expect(await Editor.placeById(live.id)).toMatchObject({ phone: null, website: null, schemaType: null })
    expect(await livePhoneFact(live.id)).toBeNull()
  })

  it('writes no phone fact when a live editor save or an admin save is rejected', async () => {
    enterContentScope('editor')
    const live = await created('contact-reject-live')
    await Editor.savePlace({
      id: live.id,
      slug: live.slug,
      title: live.title,
      summary: 'Живое описание',
      body: 'Живой текст страницы.',
      publicationStatus: 'published',
    })
    const phone = {
      phone: '+7 4012 30-30-40',
      phoneSourceUrl: CONTACTS,
      website: SITE,
    }
    await expect(
      updatePlaceDraft(
        {
          id: live.id,
          body: 'Это уютная атмосфера у вокзала.',
          ...phone,
        },
        'place_update',
      ),
    ).rejects.toMatchObject({ statusCode: 400 })
    expect((await Editor.placeById(live.id))?.phone).toBeNull()
    expect(await livePhoneFact(live.id)).toBeNull()

    await expect(
      saveAdminPlace(
        live.id,
        {
          body: 'Это уютная атмосфера у вокзала.',
          publicationStatus: 'published',
          ...phone,
        },
        null,
      ),
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(await livePhoneFact(live.id)).toBeNull()
  })

  it('writes no phone fact when a pending draft is still in the way of an admin save', async () => {
    const live = await publishedPlace('contact-admin-pending')
    enterContentScope('draft')
    await updatePlaceDraft({ id: live.id, body: 'Текст черновика места про ров.' }, 'place_update')
    enterContentScope('editor')
    await expect(
      saveAdminPlace(
        live.id,
        {
          phone: '+7 4012 30-30-40',
          phoneSourceUrl: CONTACTS,
          website: SITE,
          publicationStatus: 'published',
        },
        null,
      ),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(await livePhoneFact(live.id)).toBeNull()
    expect((await Editor.placeById(live.id))?.phone).toBeNull()
    expect(await Editor.contentDraft('place', live.id)).not.toBeNull()
  })

  it('writes no phone fact when applying a pending draft fails', async () => {
    const live = await publishedPlace('contact-apply-fail')
    await Editor.saveContentDraft({
      entityType: 'place',
      entityId: live.id,
      publicationStatus: 'review',
      payload: {
        phone: '+7 4012 30-30-40',
        phoneSourceUrl: CONTACTS,
        website: SITE,
        title: 'Черновик с телефоном',
        sources: Array.from({ length: SOURCE_LINK_LIMIT + 1 }, (_, index) => ({
          title: `Источник ${index + 1}`,
          url: `https://contact-museum.example.org/src/${index + 1}`,
        })),
      },
    })
    enterContentScope('editor')
    await expect(
      setPublication({ entity: 'place', id: live.id, publicationStatus: 'published' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: expect.stringContaining('источников'),
    })
    expect((await Editor.placeById(live.id))?.phone).toBeNull()
    expect((await Editor.placeById(live.id))?.title).toBe('Живая кирха')
    expect(await livePhoneFact(live.id)).toBeNull()
    expect(await Editor.contentDraft('place', live.id)).not.toBeNull()
  })

  it('writes no coordinate or status fact when a live editor save or an admin save is rejected', async () => {
    const live = await publishedPlace('contact-reject-point')
    enterContentScope('editor')
    const point = { latitude: 54.71, longitude: 20.51, status: 'open' as const }
    await expect(
      updatePlaceDraft(
        {
          id: live.id,
          body: 'Это уютная атмосфера у вокзала.',
          ...point,
        },
        'place_update',
      ),
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(await Editor.placeById(live.id)).toMatchObject({ latitude: null, longitude: null, status: 'unknown' })
    expect(await slotFact(live.id, 'coordinates')).toBeNull()
    expect(await slotFact(live.id, 'status')).toBeNull()

    await expect(
      saveAdminPlace(
        live.id,
        {
          body: 'Это уютная атмосфера у вокзала.',
          publicationStatus: 'published',
          ...point,
        },
        null,
      ),
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(await Editor.placeById(live.id)).toMatchObject({ latitude: null, longitude: null, status: 'unknown' })
    expect(await slotFact(live.id, 'coordinates')).toBeNull()
    expect(await slotFact(live.id, 'status')).toBeNull()
  })
})
