import process from 'node:process'
import { useCreateDatabase, useDatabase } from '@k39/database'
import { classifyOfficialUrl, ownWebsiteProblem } from '@k39/types/official-url'

/** Read-only review input. Never relabel existing facts or rewrite a URL. */
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}
useCreateDatabase(process.env.DATABASE_URL)
const pool = useDatabase().$client
const client = await pool.connect()
try {
  await client.query('BEGIN READ ONLY')
  const websites = await client.query<{ entity: string, id: string, slug: string, website: string }>(`
    SELECT 'place' AS entity, id, slug, website FROM places
    WHERE publication_status = 'published' AND website IS NOT NULL AND website <> ''
    UNION ALL
    SELECT 'venue' AS entity, id, slug, website FROM venues
    WHERE status IN ('published', 'closed') AND website IS NOT NULL AND website <> ''
    ORDER BY entity, slug
  `)
  const facts = await client.query<{ id: string, kind: string, subject_type: string, subject_id: string, source_url: string }>(`
    SELECT id, kind, subject_type, subject_id, source_url FROM facts
    WHERE source_kind = 'official' AND retired_at IS NULL AND source_url IS NOT NULL
    ORDER BY subject_type, subject_id, id
  `)
  console.log(JSON.stringify({
    websites: websites.rows.flatMap((row) => {
      const problem = ownWebsiteProblem(row.website)
      return problem ? [{ ...row, problem }] : []
    }),
    facts: facts.rows.flatMap((row) => {
      const classification = classifyOfficialUrl(row.source_url)
      const allowedMenuDocument = row.kind === 'price' && classification === 'document'
      return classification === 'official' || allowedMenuDocument ? [] : [{ ...row, classification }]
    }),
  }, null, 2))
} finally {
  await client.query('ROLLBACK')
  client.release()
  await pool.end()
}
