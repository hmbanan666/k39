import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('map loaders', () => {
  it('exports loadMap from the visitor module only', () => {
    const root = resolve(import.meta.dirname, '..')
    const embed = readFileSync(resolve(root, 'server/utils/map/load.ts'), 'utf8')
    const catalog = readFileSync(resolve(root, 'server/utils/map/public.ts'), 'utf8')
    const route = readFileSync(resolve(root, 'server/api/public/map.get.ts'), 'utf8')
    expect(embed).toContain('export async function loadEmbedMap')
    expect(embed).not.toContain('function loadMap')
    expect(catalog).toContain('export async function loadMap')
    expect(route).toContain('loadEmbedMap')
    expect(route).toContain('loadMap')
    expect(route).not.toContain('loadMap as')
  })
})
