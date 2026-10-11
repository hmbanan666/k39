import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { db, useCreateDatabase, useMigrateDatabase } from '@k39/database'
import { processImage } from '../server/media/process'
import { withMediaSlot } from '../server/media/semaphore'
import { createLocalMediaStorage, mediaRoot } from '../server/media/storage'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required')
}
useCreateDatabase(databaseUrl)
await useMigrateDatabase()
const storage = createLocalMediaStorage()
const rows = await db.editor.listAllMedia()
let rebuilt = 0
for (const row of rows) {
  const masterKey = `${row.id}/master.webp`
  const master = await storage.get(masterKey)
  const legacy = master ? null : await readFile(`${mediaRoot()}/${row.filename}`).catch(() => null)
  const source = master ?? legacy
  if (!source) {
    await db.editor.updateMedia(row.id, { status: 'failed' })
    continue
  }
  const processed = await withMediaSlot(() => processImage(source, row.id, storage))
  await db.editor.updateMedia(row.id, {
    filename: processed.filename,
    mime: processed.mime,
    bytes: processed.bytes,
    width: processed.width,
    height: processed.height,
    status: 'ready',
    variants: processed.variants,
    lqip: processed.lqip,
    dominantColor: processed.dominantColor,
  })
  rebuilt += 1
}
console.log(`Rebuilt ${rebuilt} of ${rows.length} media files`)
