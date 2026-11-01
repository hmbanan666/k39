import { describe, expect, it } from 'vitest'
import { slugError } from '../shared/seo'

describe('place slug validation', () => {
  it.each(['kabinet', 'poisk', 'gde-poest-seychas'])('rejects the built-in /%s route', (slug) => {
    expect(slugError(slug)).toBe('Этот адрес занят разделом сайта.')
  })

  it('allows place slugs that only start with a reserved route name', () => {
    expect(slugError('kabinet-muzey')).toBeNull()
    expect(slugError('poisk-muzey')).toBeNull()
  })
})
