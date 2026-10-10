import type { Database } from './connection'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { createConnection } from './connection'
import { resolveMigrationsFolder } from './migrations'

let instance: Database | null = null

export function useCreateDatabase(databaseURL: string) {
  instance = createConnection(databaseURL)
}

export function isDatabaseReady() {
  return instance !== null
}

export async function useMigrateDatabase() {
  if (!instance) {
    throw new Error('Database is not created')
  }

  await migrate(instance, {
    migrationsFolder: resolveMigrationsFolder(),
  })
}

export function useDatabase(): Database {
  if (!instance) {
    throw new Error('Database is not created')
  }

  return instance
}
