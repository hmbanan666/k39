import process from 'node:process'
import { applyFixtures, useCreateDatabase, useDatabase, useMigrateDatabase } from '@k39/database'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

useCreateDatabase(url)
await useMigrateDatabase()
const result = await applyFixtures()
console.log(JSON.stringify(result, null, 2))
await useDatabase().$client.end()
