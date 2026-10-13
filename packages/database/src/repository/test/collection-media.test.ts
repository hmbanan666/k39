import { beforeEach, describe, expect, it } from 'vitest'
import { useDatabase } from '../../database'
import { collectionMedia, collections, media } from '../../tables'
import { Content, Editor } from '../content'

describe('collection media', () => {
  beforeEach(async () => {
    const db = useDatabase()
    await db.delete(collectionMedia)
    await db.delete(collections)
    await db.delete(media)
  })

  it('makes the first photo the cover, keeps order, and moves the cover on detach', async () => {
    const collection = await Editor.saveCollection({ slug: 'month-test', title: 'Месяц', publicationStatus: 'published' })
    const first = await Editor.saveMedia({ filename: 'a.webp', mime: 'image/webp', bytes: 1, width: 10, height: 10, alt: 'Первое' })
    const second = await Editor.saveMedia({ filename: 'b.webp', mime: 'image/webp', bytes: 1, width: 10, height: 10, alt: 'Второе' })
    const firstId = first?.id ?? ''
    const secondId = second?.id ?? ''
    await Editor.attachCollectionMedia(collection.id, firstId)
    await Editor.attachCollectionMedia(collection.id, secondId)
    let gallery = await Content.collectionGallery(collection.id)
    expect(gallery.map((item) => [item.media.alt, item.isCover])).toEqual([['Первое', true], ['Второе', false]])

    await Editor.attachCollectionMedia(collection.id, secondId, { isCover: true })
    gallery = await Content.collectionGallery(collection.id)
    expect(gallery[0]?.media.alt).toBe('Второе')

    await Editor.detachCollectionMedia(collection.id, secondId)
    gallery = await Content.collectionGallery(collection.id)
    expect(gallery.map((item) => [item.media.alt, item.isCover])).toEqual([['Первое', true]])
  })
})
