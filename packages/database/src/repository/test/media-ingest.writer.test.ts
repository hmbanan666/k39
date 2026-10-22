// Lives in the database suite so it uses that Postgres.
// The .writer.test.ts suffix is the typecheck rule: this package's tsc
// excludes it, and scripts/typecheck-writer.mjs includes every match.
import { Buffer } from 'node:buffer'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { ingestImage } from '../../../../../apps/web-app/server/media/ingest'
import { useDatabase } from '../../database'
import { media } from '../../tables'
import { Editor } from '../content'

async function mediaIds() {
  const rows = await useDatabase().select({ id: media.id }).from(media)
  return rows.map((row) => row.id).sort()
}

describe('rejected image ingest', () => {
  const roots: string[] = []
  const previousMedia = process.env.MEDIA_DIR

  afterAll(async () => {
    if (previousMedia === undefined) {
      delete process.env.MEDIA_DIR
    } else {
      process.env.MEDIA_DIR = previousMedia
    }
    await useDatabase().delete(media).where(eq(media.alt, 'ingest-test'))
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('returns 400 for a text file declared as jpeg and inserts no media row', async () => {
    const root = await mkdtemp(join(tmpdir(), 'k39-ingest-'))
    roots.push(root)
    process.env.MEDIA_DIR = root
    const before = await mediaIds()
    const result = await ingestImage({
      bytes: Buffer.from('not an image, just text'),
      mime: 'image/jpeg',
      filename: 'note.jpg',
      alt: 'Двор форта утром',
    })
    expect(result).toMatchObject({
      error: 'Не удалось прочитать изображение.',
      statusCode: 400,
    })
    expect(await mediaIds()).toEqual(before)
    const failed = await useDatabase().select({ id: media.id }).from(media).where(eq(media.status, 'failed'))
    expect(failed.filter((row) => !before.includes(row.id))).toEqual([])
  })

  it('purges a zero-byte failed row and keeps a failed row that still has bytes', async () => {
    const junk = await Editor.saveMedia({
      filename: 'master.webp',
      mime: 'image/webp',
      bytes: 0,
      width: null,
      height: null,
      alt: 'ingest-test',
      status: 'failed',
    })
    const kept = await Editor.saveMedia({
      filename: 'master.webp',
      mime: 'image/webp',
      bytes: 1200,
      width: null,
      height: null,
      alt: 'ingest-test',
      status: 'failed',
    })
    const removed = await Editor.deleteFailedUploads()
    expect(removed.map((row) => row.id)).toContain(junk.id)
    expect(removed.map((row) => row.id)).not.toContain(kept.id)
    expect(await Editor.mediaById(junk.id)).toBeUndefined()
    expect(await Editor.mediaById(kept.id)).toMatchObject({ status: 'failed', bytes: 1200 })
    await Editor.deleteMedia(kept.id)
  })
})
