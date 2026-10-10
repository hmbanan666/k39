import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import process from 'node:process'
import pg from 'pg'
import { afterAll, beforeAll } from 'vitest'
import { isDatabaseReady, useCreateDatabase, useDatabase, useMigrateDatabase } from '../src/database'

let container: StartedPostgreSqlContainer | undefined

function isLocalDatabase(connectionString: string) {
  const url = new URL(connectionString)
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === ''
}

// Drizzle stores applied migrations in the drizzle schema, outside public.
async function resetLocalSchema(connectionString: string) {
  const pool = new pg.Pool({ connectionString })
  await pool.query('drop schema if exists drizzle cascade')
  await pool.query('drop schema if exists public cascade')
  await pool.query('create schema public')
  await pool.end()
}

async function initDb() {
  const fromEnv = process.env.DATABASE_URL
  if (fromEnv) {
    if (!isLocalDatabase(fromEnv)) {
      throw new Error('Refusing to reset a non-local DATABASE_URL for tests')
    }
    await resetLocalSchema(fromEnv)
    useCreateDatabase(fromEnv)
    await useMigrateDatabase()
    return
  }

  const { PostgreSqlContainer } = await import('@testcontainers/postgresql')
  container = await new PostgreSqlContainer('postgres:18').start()
  useCreateDatabase(container.getConnectionUri())
  await useMigrateDatabase()
}

beforeAll(async () => {
  await initDb()
})

afterAll(async () => {
  if (isDatabaseReady()) {
    await useDatabase().$client.end()
  }
  if (container) {
    await container.stop()
  }
})
