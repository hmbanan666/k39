import { describe, expect, it } from 'vitest'
import { adminRedirect } from '../shared/auth'

describe('admin guard', () => {
  it('sends anonymous visitors to sign-in and keeps the return path', () => {
    expect(adminRedirect(null)).toBe('/sign-in?redirectTo=/admin')
    expect(adminRedirect(undefined)).toBe('/sign-in?redirectTo=/admin')
  })

  it('lets editors and admins in and sends everyone else home', () => {
    expect(adminRedirect({ role: 'admin' })).toBeNull()
    expect(adminRedirect({ role: 'editor' })).toBeNull()
    expect(adminRedirect({ role: 'user' })).toBe('/')
  })
})
