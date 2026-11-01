import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { slugError } from '../shared/seo'

describe('place slug validation', () => {
  it.each(['kabinet', 'poisk', 'gde-poest-seychas', 'lastochka', 'pages', 'sitemap-urls'])(
    'rejects the built-in /%s route',
    (slug) => {
      expect(slugError(slug)).toBe('Этот адрес занят разделом сайта.')
    },
  )

  const pageSlugs = readdirSync(resolve(process.cwd(), 'apps/web-app/app/pages'))
    .filter((name) => name !== 'index.vue' && !name.startsWith('['))
    .map((name) => name.replace(/\.vue$/, ''))

  it.each(pageSlugs)('reserves the top-level page section /%s', (slug) => {
    expect(slugError(slug)).toBe('Этот адрес занят разделом сайта.')
  })

  it('allows place slugs that only start with a reserved route name', () => {
    expect(slugError('kabinet-muzey')).toBeNull()
    expect(slugError('poisk-muzey')).toBeNull()
    expect(slugError('gde-poest-seychas-v-kaliningrade')).toBeNull()
  })
})
