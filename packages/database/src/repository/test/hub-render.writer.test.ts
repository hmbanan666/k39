// Lives in the database suite so it uses that Postgres.
// The .writer.test.ts suffix is the typecheck rule: this package's tsc
// excludes it, and scripts/typecheck-writer.mjs includes every match.
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { enterContentScope } from '../../../../../apps/web-app/server/utils/access'
import { saveAdminHub } from '../../../../../apps/web-app/server/utils/admin/hub'
import { listHubs, updateHub } from '../../../../../apps/web-app/server/utils/mcp/hubs'
import { HUB_RENDERED_FIELDS } from '../../../../../apps/web-app/shared/page-modules'
import { useDatabase } from '../../database'
import { categories, mcpAudits, pageReviews, verificationQueue } from '../../tables'

const ids: string[] = []

afterEach(async () => {
  const database = useDatabase()
  for (const id of ids) {
    await database.delete(verificationQueue).where(eq(verificationQueue.entityId, id))
    await database.delete(pageReviews).where(eq(pageReviews.entityId, id))
    await database.delete(mcpAudits).where(eq(mcpAudits.entityId, id))
    await database.delete(categories).where(eq(categories.id, id))
  }
  ids.length = 0
})

describe('hub rendered fields', () => {
  it('returns renderedFields from the list, the update, and the admin save', async () => {
    enterContentScope('editor')
    const database = useDatabase()
    const [created] = await database.insert(categories).values({
      slug: 'hub-render-fields',
      title: 'Раздел',
      description: 'Короткое описание раздела.',
      body: 'Старый текст раздела.',
    }).returning()
    if (!created) {
      throw new Error('category insert failed')
    }
    ids.push(created.id)

    const listed = (await listHubs()).find((row) => row.slug === 'hub-render-fields')
    expect(listed?.article).toBe('body')
    expect(listed?.renderedFields).toEqual([...HUB_RENDERED_FIELDS])
    expect(listed?.renderedFields).toContain('body')

    const updated = await updateHub({
      slug: 'hub-render-fields',
      body: 'Новый текст раздела про вал.',
    })
    expect(updated.renderedFields).toEqual([...HUB_RENDERED_FIELDS])
    expect(updated.body).toBe('Новый текст раздела про вал.')
    expect(updated.article).toBe('body')

    const admin = await saveAdminHub(created.id, {
      title: 'Раздел',
      description: 'Короткое описание раздела.',
      body: 'Текст раздела из админки.',
    })
    expect(admin.renderedFields).toEqual([...HUB_RENDERED_FIELDS])
    expect(admin.body).toBe('Текст раздела из админки.')
    expect(admin.article).toBe('body')
  })
})
