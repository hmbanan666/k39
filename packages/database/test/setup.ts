import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import process from 'node:process'
import pg from 'pg'
import { afterAll, beforeAll } from 'vitest'
import { isDatabaseReady, useCreateDatabase, useDatabase, useMigrateDatabase } from '../src/database'
import { assertResettable, maintenanceUrls, resolveTestDatabaseUrl } from './test-database'

let container: StartedPostgreSqlContainer | undefined

async function ensureTestDatabase(connectionString: string, name: string) {
  const errors: string[] = []
  for (const adminUrl of maintenanceUrls(connectionString)) {
    const pool = new pg.Pool({ connectionString: adminUrl })
    try {
      const existing = await pool.query('select 1 from pg_database where datname = $1', [name])
      if ((existing.rowCount ?? 0) === 0) {
        await pool.query(`create database "${name}"`)
      }
      return
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    } finally {
      await pool.end()
    }
  }
  throw new Error(`Could not create test database ${name}. ${errors.join(' ')}`)
}

// Drizzle stores applied migrations in the drizzle schema, outside public.
async function resetTestSchema(connectionString: string) {
  const name = assertResettable(connectionString)
  const pool = new pg.Pool({ connectionString })
  await pool.query('drop schema if exists drizzle cascade')
  await pool.query('drop schema if exists public cascade')
  await pool.query('create schema public')
  await pool.end()
  return name
}

async function initDb() {
  const url = resolveTestDatabaseUrl(process.env)
  if (url) {
    const name = assertResettable(url)
    await ensureTestDatabase(url, name)
    await resetTestSchema(url)
    useCreateDatabase(url)
    await useMigrateDatabase()
    return
  }

  const { PostgreSqlContainer } = await import('@testcontainers/postgresql')
  container = await new PostgreSqlContainer('postgres:18')
    .withLabels(process.env.AO_SESSION_ID ? { 'ao.session': process.env.AO_SESSION_ID } : {})
    .start()
  const ephemeral = container.getConnectionUri()
  const testName = 'k39_test'
  const testUrl = new URL(ephemeral)
  testUrl.pathname = `/${testName}`
  await ensureTestDatabase(ephemeral, testName)
  const resolved = testUrl.toString()
  await resetTestSchema(resolved)
  useCreateDatabase(resolved)
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
