import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getIconData } from '@iconify/utils'
import { describe, expect, it } from 'vitest'
import { TABLER_ICONS, tablerIcon, tablerIconList, tablerName } from '../shared/icons'

const collection = JSON.parse(
  readFileSync(resolve(process.cwd(), 'node_modules/@iconify-json/tabler/icons.json'), 'utf8'),
)

describe('tabler icon map', () => {
  it('points every site key at a real Tabler icon', () => {
    for (const [key, name] of Object.entries(TABLER_ICONS)) {
      expect(tablerName(key)).toBe(name)
      expect(tablerIcon(key)).toBe(`tabler:${name}`)
      expect(getIconData(collection, name)?.body).toContain('stroke')
    }
    expect(tablerName('missing')).toBe(TABLER_ICONS.other)
    expect(tablerIconList().every((name) => name.startsWith('tabler:'))).toBe(true)
  })
})
