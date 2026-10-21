import { db, isDatabaseReady } from '@k39/database'
import { removeStoredMedia } from '../media/ingest'

// Drops failed rows that a rejected upload used to leave behind (bytes 0).
// media-rebuild still marks a missing master as failed and those rows stay.
export default defineNitroPlugin(() => {
  const run = () => {
    if (!isDatabaseReady()) {
      return
    }
    db.editor.deleteFailedUploads().then(async (rows) => {
      await Promise.all(rows.map((row) => removeStoredMedia(row.id)))
    }).catch((error: unknown) => {
      console.error('failed media purge', error)
    })
  }
  const start = setTimeout(run, 75_000)
  const timer = setInterval(run, 24 * 60 * 60 * 1000)
  start.unref?.()
  timer.unref?.()
})
