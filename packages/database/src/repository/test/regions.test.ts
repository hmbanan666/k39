import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COASTAL_DISTRICTS } from '../../seed/coastal-districts'
import { Editor } from '../content'

describe('coastal districts', () => {
  it('names the four municipalities in the migration', () => {
    const path = [
      resolve(process.cwd(), 'migrations/0010_coastal_districts.sql'),
      resolve(process.cwd(), 'packages/database/migrations/0010_coastal_districts.sql'),
    ].find((item) => existsSync(item))
    const sql = readFileSync(path ?? '', 'utf8')
    expect(sql).toContain('"latitude"')
    expect(sql).toContain('"longitude"')
    for (const [slug, title] of COASTAL_DISTRICTS) {
      expect(sql).toContain(`'${slug}'`)
      expect(sql).toContain(`'${title}'`)
    }
  })

  it('inserts a region and updates its name and center without wiping an omitted point', async () => {
    const created = await Editor.upsertRegion({
      slug: 'yantarny',
      title: 'Янтарный',
    })
    expect(created.latitude).toBeNull()
    expect(created.longitude).toBeNull()

    const moved = await Editor.upsertRegion({
      slug: 'yantarny',
      title: 'Янтарный городской округ',
      latitude: 54.871,
      longitude: 19.94,
    })
    expect(moved.id).toBe(created.id)
    expect(moved.title).toBe('Янтарный городской округ')
    expect(moved.latitude).toBe(54.871)
    expect(moved.longitude).toBe(19.94)

    const renamed = await Editor.upsertRegion({
      slug: 'yantarny',
      title: 'Янтарный городской округ',
      description: 'Побережье.',
    })
    expect(renamed.latitude).toBe(54.871)
    expect(renamed.longitude).toBe(19.94)
    expect(renamed.description).toBe('Побережье.')

    const cleared = await Editor.upsertRegion({
      slug: 'yantarny',
      title: 'Янтарный городской округ',
      latitude: null,
      longitude: null,
    })
    expect(cleared.latitude).toBeNull()
    expect(cleared.longitude).toBeNull()
    expect(cleared.description).toBe('Побережье.')
  })
})
