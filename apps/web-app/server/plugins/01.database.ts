import type { CatalogSnapshot } from '@k39/database'
import process from 'node:process'
import { db, useCreateDatabase, useMigrateDatabase } from '@k39/database'
import catalog from '../../shared/data/catalog.json'

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
  await db.catalog.apply(catalog as CatalogSnapshot)
  logger.success('Database ready')
})
