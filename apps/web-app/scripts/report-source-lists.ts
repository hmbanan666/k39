import process from 'node:process'
import { prepareSourceLinks, SourceInputError, useCreateDatabase, useDatabase } from '@k39/database'

/** Read-only legacy-source audit. Never trims, migrates, publishes or applies a draft. */
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}
useCreateDatabase(process.env.DATABASE_URL)
const pool = useDatabase().$client
const client = await pool.connect()
try {
  await client.query('BEGIN READ ONLY')
  const result = await client.query<{ entity: string, id: string, slug: string | null, origin: string, sources: unknown }>(`
    SELECT 'place' AS entity, id, slug, 'stored' AS origin, sources FROM places
    UNION ALL SELECT 'collection', id, slug, 'stored', sources FROM collections
    UNION ALL SELECT 'venue', id, slug, 'stored', sources FROM venues
    UNION ALL SELECT entity_type, entity_id, NULL, 'pending', payload->'sources'
      FROM content_drafts WHERE payload ? 'sources'
    ORDER BY entity, id, origin
  `)
  const problems = result.rows.flatMap(({ sources, ...row }) => {
    if (sources == null) {
      return []
    }
    if (!Array.isArray(sources) || sources.some((source) => !source || typeof source !== 'object' || typeof source.title !== 'string' || typeof source.url !== 'string')) {
      return [{ ...row, problem: 'Invalid source list shape' }]
    }
    try {
      prepareSourceLinks(sources)
      return []
    } catch (error) {
      if (!(error instanceof SourceInputError)) {
        throw error
      }
      return [{ ...row, rows: sources.length, problem: error.message }]
    }
  })
  console.log(JSON.stringify({ scanned: result.rows.length, problems }, null, 2))
} finally {
  await client.query('ROLLBACK')
  client.release()
  await pool.end()
}
