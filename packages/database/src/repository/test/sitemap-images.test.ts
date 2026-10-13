import { beforeEach, describe, expect, it } from 'vitest'
import { useDatabase } from '../../database'
import { media, placeMedia, venueMedia, venues } from '../../tables'
import { Content, Editor } from '../content'
import { Venues } from '../venues'

describe('sitemap venue images', () => {
  beforeEach(async () => {
    const db = useDatabase()
    await db.delete(venueMedia)
    await db.delete(placeMedia)
    await db.delete(media)
    await db.delete(venues)
  })

  it('lists a published venue photo and its updatedAt', async () => {
    const description = 'Кафе у форта варит кофе и кормит обедом после экскурсии. '.repeat(8)
    const venue = await Venues.create({
      name: 'Кофейня у форта',
      slug: 'kofeynya-u-forta',
      kind: 'coffee',
      description,
      status: 'published',
    })
    const photo = await Editor.saveMedia({
      filename: 'cover.webp',
      mime: 'image/webp',
      bytes: 1200,
      width: 1200,
      height: 630,
      alt: 'Чашка у окна',
      variants: [{ format: 'jpeg', width: 1200, height: 630, bytes: 800, file: 'og.jpg' }],
    })
    await Venues.attachMedia(venue.id, photo.id, { isCover: true })
    const map = await Content.sitemapRows()
    const row = map.venues.find((item) => item.loc === '/zavedeniya/kofeynya-u-forta')
    expect(row?.lastmod).toBe(venue.updatedAt)
    expect(row?.images).toEqual([{ loc: `/media/${photo.id}/og.jpg`, title: 'Чашка у окна' }])

    await Venues.create({
      name: 'Черновик',
      slug: 'chernovik-kafe',
      kind: 'cafe',
      description,
      status: 'draft',
    })
    const again = await Content.sitemapRows()
    expect(again.venues.some((item) => item.loc === '/zavedeniya/chernovik-kafe')).toBe(false)
  })
})
