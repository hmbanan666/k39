import { mkdir } from 'node:fs/promises'
import process from 'node:process'
import { applyInitialContent, useCreateDatabase, useMigrateDatabase } from '@k39/database'

const logger = useLogger('db')

export default defineNitroPlugin(async () => {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL is not defined')
    }
    logger.warn('DATABASE_URL is not defined. Database features are off.')
    return
  }

  useCreateDatabase(databaseUrl)
  await useMigrateDatabase()
  await applyInitialContent()
  const mediaDir = process.env.MEDIA_DIR || '/app/media'
  await mkdir(mediaDir, { recursive: true }).catch((error: unknown) => {
    logger.warn('MEDIA_DIR is not writable', mediaDir, error)
  })
  logger.success('Database ready')
})
